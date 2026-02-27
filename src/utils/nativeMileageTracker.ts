import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { BackgroundGeolocationPlugin, Location, CallbackError } from '@capacitor-community/background-geolocation';
import { registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface MileageTrip {
  id?: string;
  startTime: Date;
  endTime?: Date;
  distance: number; // in miles
  locations: TripLocation[];
  purpose?: string;
  isBusiness: boolean;
}

export interface TripLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number; // mph
  accuracy?: number;
}

interface MileageTrackerCallbacks {
  onLocationUpdate?: (location: TripLocation, totalDistance: number) => void;
  onTripStart?: (trip: MileageTrip) => void;
  onTripEnd?: (trip: MileageTrip) => void;
  onError?: (error: Error) => void;
}

class NativeMileageTracker {
  private currentTrip: MileageTrip | null = null;
  private watcherId: string | null = null;
  private callbacks: MileageTrackerCallbacks = {};
  private isNative: boolean;
  private webWatchId: number | null = null;
  private autoStartEnabled: boolean = false;
  private autoStartSpeedMph: number = 5;
  private autoStopMinutes: number = 15;
  private lastMovementTime: number = 0;
  private autoStopCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  setCallbacks(callbacks: MileageTrackerCallbacks) {
    this.callbacks = callbacks;
  }

  async checkPermissions(): Promise<boolean> {
    try {
      if (this.isNative) {
        const status = await Geolocation.checkPermissions();
        return status.location === 'granted' || status.coarseLocation === 'granted';
      } else {
        // Web fallback
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state === 'granted';
      }
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (this.isNative) {
        const status = await Geolocation.requestPermissions();
        return status.location === 'granted';
      } else {
        // Web fallback - requesting location triggers permission prompt
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { enableHighAccuracy: true }
          );
        });
      }
    } catch {
      return false;
    }
  }

  async startTracking(isBusiness: boolean = true): Promise<void> {
    if (this.currentTrip) {
      console.log('Trip already in progress');
      return;
    }

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Location permission not granted');
      }
    }

    // Initialize new trip
    this.currentTrip = {
      startTime: new Date(),
      distance: 0,
      locations: [],
      isBusiness,
    };

    this.callbacks.onTripStart?.(this.currentTrip);
    this.lastMovementTime = Date.now();

    if (this.isNative) {
      await this.startNativeTracking();
    } else {
      await this.startWebTracking();
    }

    // Start auto-stop check
    this.startAutoStopCheck();
  }

  private async startNativeTracking(): Promise<void> {
    try {
      // Add watcher for background geolocation
      this.watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking mileage in background',
          backgroundTitle: 'Books Your Way',
          requestPermissions: true,
          stale: false,
          distanceFilter: 10, // meters
        },
        (position?: Location, error?: CallbackError) => {
          if (error) {
            this.callbacks.onError?.(error);
            return;
          }
          if (position) {
            this.handleLocationUpdate({
              latitude: position.latitude,
              longitude: position.longitude,
              timestamp: position.time || Date.now(),
              speed: position.speed ? position.speed * 2.237 : undefined, // m/s to mph
              accuracy: position.accuracy,
            });
          }
        }
      );
    } catch (error) {
      throw new Error(`Failed to start native tracking: ${error}`);
    }
  }

  private async startWebTracking(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      this.webWatchId = navigator.geolocation.watchPosition(
        (position: GeolocationPosition) => {
          this.handleLocationUpdate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp,
            speed: position.coords.speed ? position.coords.speed * 2.237 : undefined,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          this.callbacks.onError?.(new Error(error.message));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        }
      );
      resolve();
    });
  }

  private handleLocationUpdate(location: TripLocation): void {
    if (!this.currentTrip) return;

    const locations = this.currentTrip.locations;

    // Calculate distance from last point
    if (locations.length > 0) {
      const lastLocation = locations[locations.length - 1];
      const distance = this.calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        location.latitude,
        location.longitude
      );

      // Only add point if moved more than ~30 feet (0.005 miles)
      if (distance > 0.005) {
        this.currentTrip.distance += distance;
        this.currentTrip.locations.push(location);

        // Update last movement time if speed > 2 mph
        if (location.speed && location.speed > 2) {
          this.lastMovementTime = Date.now();
        }
      }
    } else {
      // First location
      this.currentTrip.locations.push(location);
      this.lastMovementTime = Date.now();
    }

    this.callbacks.onLocationUpdate?.(location, this.currentTrip.distance);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula - returns distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private startAutoStopCheck(): void {
    if (this.autoStopCheckInterval) {
      clearInterval(this.autoStopCheckInterval);
    }

    this.autoStopCheckInterval = setInterval(() => {
      const idleTime = (Date.now() - this.lastMovementTime) / 1000 / 60; // minutes
      if (idleTime >= this.autoStopMinutes && this.currentTrip) {
        console.log(`Auto-stopping after ${this.autoStopMinutes} minutes of inactivity`);
        this.stopTracking();
      }
    }, 60000); // Check every minute
  }

  async stopTracking(): Promise<MileageTrip | null> {
    if (!this.currentTrip) {
      return null;
    }

    // Stop auto-stop check
    if (this.autoStopCheckInterval) {
      clearInterval(this.autoStopCheckInterval);
      this.autoStopCheckInterval = null;
    }

    // Stop location updates
    if (this.isNative && this.watcherId) {
      await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      this.watcherId = null;
    } else if (this.webWatchId !== null) {
      navigator.geolocation.clearWatch(this.webWatchId);
      this.webWatchId = null;
    }

    // Finalize trip
    this.currentTrip.endTime = new Date();
    const completedTrip = { ...this.currentTrip };

    this.callbacks.onTripEnd?.(completedTrip);
    this.currentTrip = null;

    return completedTrip;
  }

  getCurrentTrip(): MileageTrip | null {
    return this.currentTrip ? { ...this.currentTrip } : null;
  }

  isTracking(): boolean {
    return this.currentTrip !== null;
  }

  async getCurrentPosition(): Promise<TripLocation | null> {
    try {
      if (this.isNative) {
        const position: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
        });
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
          speed: position.coords.speed ? position.coords.speed * 2.237 : undefined,
          accuracy: position.coords.accuracy,
        };
      } else {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: position.timestamp,
                speed: position.coords.speed ? position.coords.speed * 2.237 : undefined,
                accuracy: position.coords.accuracy,
              });
            },
            (error) => reject(error),
            { enableHighAccuracy: true }
          );
        });
      }
    } catch {
      return null;
    }
  }

  // Auto-start settings
  setAutoStart(enabled: boolean, speedMph: number = 5): void {
    this.autoStartEnabled = enabled;
    this.autoStartSpeedMph = speedMph;
  }

  setAutoStopMinutes(minutes: number): void {
    this.autoStopMinutes = minutes;
  }

  isNativePlatform(): boolean {
    return this.isNative;
  }

  // Calculate tax deduction
  calculateDeduction(miles: number, rate: number = 0.67): number {
    return miles * rate;
  }
}

// Singleton instance
export const mileageTracker = new NativeMileageTracker();

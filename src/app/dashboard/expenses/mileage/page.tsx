'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { expensesSupabase } from '@/utils/expensesSupabase';
import { useUserMode } from '@/contexts/UserModeContext';
import { mileageTracker, MileageTrip as NativeTrip, TripLocation } from '@/utils/nativeMileageTracker';

interface MileageTrip {
  id: string;
  date: string;
  distance: number;
  start_location: string;
  end_location: string;
  purpose: string;
  is_business: boolean;
  rate: number;
  amount: number;
}

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const MIN_ACCURACY_METERS = 100;
const MIN_SPEED_MPH = 5;

export default function MileagePage() {
  const { isBusiness: defaultIsBusiness } = useUserMode();
  const [trips, setTrips] = useState<MileageTrip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<MileageTrip[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [startLocation, setStartLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isBusiness, setIsBusiness] = useState(defaultIsBusiness);
  const [rate, _setRate] = useState(0.67); // 2024 IRS rate
  const [idleTime, setIdleTime] = useState(0);
  const [isNativePlatform, setIsNativePlatform] = useState(false);

  const [typeFilter, setTypeFilter] = useState<'all' | 'business' | 'personal'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'quarter' | 'year'>('all');

  // Edit modal state
  const [editingTrip, setEditingTrip] = useState<MileageTrip | null>(null);
  const [editPurpose, setEditPurpose] = useState('');
  const [editIsBusiness, setEditIsBusiness] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lon: number; timestamp: number } | null>(null);
  const autoStartTriggered = useRef(false);
  const isTrackingRef = useRef(false);
  const distanceRef = useRef(0);
  const lastMovementTimeRef = useRef<number>(Date.now());
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startLocationRef = useRef('');
  const purposeRef = useRef('');
  const isBusinessRef = useRef(true);

  // Check if running on native platform
  useEffect(() => {
    setIsNativePlatform(mileageTracker.isNativePlatform());
  }, []);

  // Save completed trip from native tracker
  const saveNativeTrip = useCallback(async (trip: NativeTrip) => {
    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) return;

      let startLoc = '';
      let endLoc = '';

      if (trip.locations.length > 0) {
        const first = trip.locations[0];
        const last = trip.locations[trip.locations.length - 1];
        startLoc = await reverseGeocode(first.latitude, first.longitude);
        endLoc = await reverseGeocode(last.latitude, last.longitude);
      }

      const amount = trip.distance * rate;

      await expensesSupabase.from('mileage').insert({
        user_id: user.id,
        date: trip.startTime.toISOString().split('T')[0],
        distance: trip.distance,
        start_location: startLoc || null,
        end_location: endLoc || null,
        purpose: trip.purpose || purpose || null,
        is_business: trip.isBusiness,
        rate,
        amount
      });

      setPurpose('');
      loadTrips();
    } catch (error) {
      console.error('Error saving native trip:', error);
    }
  }, [purpose, rate]);

  // Setup native tracker callbacks
  useEffect(() => {
    if (isNativePlatform) {
      mileageTracker.setCallbacks({
        onLocationUpdate: (location: TripLocation, totalDistance: number) => {
          setDistance(totalDistance);
          if (location.speed) {
            setCurrentSpeed(location.speed);
          }
        },
        onTripStart: () => {
          setIsTracking(true);
        },
        onTripEnd: (trip: NativeTrip) => {
          setIsTracking(false);
          setDistance(0);
          if (trip.distance > 0.01) {
            saveNativeTrip(trip);
          }
        },
        onError: (error: Error) => {
          console.error('Mileage tracker error:', error);
        }
      });
    }
  }, [isNativePlatform, saveNativeTrip]);

  useEffect(() => {
    loadTrips();
    if (!isNativePlatform) {
      startSpeedMonitoring();
    }
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (idleCheckIntervalRef.current) clearInterval(idleCheckIntervalRef.current);
    };
  }, [isNativePlatform]);

  // Update isBusiness when mode changes (only when not tracking)
  useEffect(() => {
    if (!isTracking) {
      setIsBusiness(defaultIsBusiness);
    }
  }, [defaultIsBusiness, isTracking]);

  useEffect(() => { applyFilters(); }, [trips, typeFilter, dateFilter]);

  // Idle check interval
  useEffect(() => {
    if (isTracking) {
      idleCheckIntervalRef.current = setInterval(() => {
        const idleMs = Date.now() - lastMovementTimeRef.current;
        setIdleTime(Math.floor(idleMs / 1000));

        if (idleMs >= IDLE_TIMEOUT_MS && isTrackingRef.current && distanceRef.current > 0) {
          handleStopTracking(true);
        }
      }, 30000);
    } else {
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
      setIdleTime(0);
    }
    return () => {
      if (idleCheckIntervalRef.current) clearInterval(idleCheckIntervalRef.current);
    };
  }, [isTracking]);

  async function loadTrips() {
    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) return;
      const { data } = await expensesSupabase.from('mileage').select('*').eq('user_id', user.id).order('date', { ascending: false });
      setTrips(data || []);
    } catch (error) {
      console.error('Error loading trips:', error);
    }
  }

  function applyFilters() {
    let filtered = [...trips];
    if (typeFilter === 'business') filtered = filtered.filter(t => t.is_business);
    else if (typeFilter === 'personal') filtered = filtered.filter(t => !t.is_business);
    const now = new Date();
    if (dateFilter === 'month') { const m = new Date(now.getFullYear(), now.getMonth(), 1); filtered = filtered.filter(t => new Date(t.date) >= m); }
    else if (dateFilter === 'quarter') { const q = Math.floor(now.getMonth() / 3) * 3; const s = new Date(now.getFullYear(), q, 1); filtered = filtered.filter(t => new Date(t.date) >= s); }
    else if (dateFilter === 'year') { const y = new Date(now.getFullYear(), 0, 1); filtered = filtered.filter(t => new Date(t.date) >= y); }
    setFilteredTrips(filtered);
  }

  const totalMiles = filteredTrips.reduce((sum, t) => sum + t.distance, 0);
  const totalAmount = filteredTrips.reduce((sum, t) => sum + t.amount, 0);
  const businessMiles = filteredTrips.filter(t => t.is_business).reduce((sum, t) => sum + t.distance, 0);
  const personalMiles = filteredTrips.filter(t => !t.is_business).reduce((sum, t) => sum + t.distance, 0);
  const taxDeduction = businessMiles * 0.67;

  function startSpeedMonitoring() {
    if (!navigator.geolocation) { alert('Geolocation is not supported by your browser'); return; }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, accuracy } = position.coords;
        const timestamp = position.timestamp;

        let speedMph = 0;
        if (speed !== null && speed >= 0) {
          speedMph = speed * 2.237;
        } else if (lastPositionRef.current) {
          const timeDiff = (timestamp - lastPositionRef.current.timestamp) / 1000;
          if (timeDiff > 0) {
            const dist = calculateDistance(lastPositionRef.current.lat, lastPositionRef.current.lon, latitude, longitude);
            speedMph = (dist / timeDiff) * 3600;
          }
        }

        setCurrentSpeed(speedMph);

        if (speedMph >= MIN_SPEED_MPH && !isTrackingRef.current && !autoStartTriggered.current) {
          autoStartTriggered.current = true;
          handleStartTracking(latitude, longitude);
        }

        const isAccuracyGood = accuracy <= MIN_ACCURACY_METERS;

        if (isTrackingRef.current && lastPositionRef.current) {
          if (timestamp > lastPositionRef.current.timestamp) {
            const distanceMiles = calculateDistance(
              lastPositionRef.current.lat,
              lastPositionRef.current.lon,
              latitude,
              longitude
            );

            const timeDiffSeconds = (timestamp - lastPositionRef.current.timestamp) / 1000;
            const maxReasonableDistance = Math.min(0.5, (timeDiffSeconds / 3600) * 100);

            if (distanceMiles > 0.001 && distanceMiles < maxReasonableDistance) {
              if (isAccuracyGood || distanceMiles < 0.05) {
                distanceRef.current += distanceMiles;
                setDistance(distanceRef.current);

                if (speedMph >= 2) {
                  lastMovementTimeRef.current = Date.now();
                }
              }
            }

            lastPositionRef.current = { lat: latitude, lon: longitude, timestamp };
          }
        } else {
          lastPositionRef.current = { lat: latitude, lon: longitude, timestamp };
        }
      },
      (error) => {
        console.error('Geolocation error:', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  }

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 3958.8;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async function handleStartTracking(initialLat?: number, initialLon?: number) {
    // Use native tracker if on mobile platform
    if (isNativePlatform) {
      try {
        await mileageTracker.startTracking(isBusiness);
        const pos = await mileageTracker.getCurrentPosition();
        if (pos) {
          const start = await reverseGeocode(pos.latitude, pos.longitude);
          setStartLocation(start);
        }
      } catch (error) {
        console.error('Failed to start native tracking:', error);
        alert('Failed to start tracking. Please check location permissions.');
      }
      return;
    }

    // Web-based tracking
    setIsTracking(true);
    isTrackingRef.current = true;
    distanceRef.current = 0;
    setDistance(0);
    lastMovementTimeRef.current = Date.now();

    if (initialLat !== undefined && initialLon !== undefined) {
      lastPositionRef.current = { lat: initialLat, lon: initialLon, timestamp: Date.now() };
      const start = await reverseGeocode(initialLat, initialLon);
      setStartLocation(start);
      startLocationRef.current = start;
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        lastPositionRef.current = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          timestamp: pos.timestamp
        };
        const start = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setStartLocation(start);
        startLocationRef.current = start;
      });
    }
  }

  async function handleStopTracking(isAutoSave = false) {
    // Use native tracker if on mobile platform
    if (isNativePlatform) {
      // Trip will be saved via onTripEnd callback
      await mileageTracker.stopTracking();
      return;
    }

    // Web-based tracking
    setIsTracking(false);
    isTrackingRef.current = false;
    autoStartTriggered.current = false;

    const finalDistance = distanceRef.current;

    if (finalDistance < 0.01) {
      distanceRef.current = 0;
      setDistance(0);
      setPurpose('');
      setIsBusiness(true);
      return;
    }

    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) return;

      let endLocation = '';
      if (lastPositionRef.current) {
        endLocation = await reverseGeocode(lastPositionRef.current.lat, lastPositionRef.current.lon);
      }

      const amount = finalDistance * rate;
      const tripPurpose = isAutoSave ? (purposeRef.current || 'Auto-saved trip') : (purpose || null);
      const tripIsBusiness = isAutoSave ? isBusinessRef.current : isBusiness;

      await expensesSupabase.from('mileage').insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        distance: finalDistance,
        start_location: startLocationRef.current || null,
        end_location: endLocation || null,
        purpose: tripPurpose,
        is_business: tripIsBusiness,
        rate,
        amount
      });

      setPurpose('');
      setIsBusiness(true);
      purposeRef.current = '';
      isBusinessRef.current = true;
      loadTrips();

      distanceRef.current = 0;
      setDistance(0);
    } catch (error) {
      console.error('Error saving trip:', error);
    }
  }

  useEffect(() => { purposeRef.current = purpose; }, [purpose]);
  useEffect(() => { isBusinessRef.current = isBusiness; }, [isBusiness]);

  async function reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const data = await response.json();
      return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch { return `${lat.toFixed(4)}, ${lon.toFixed(4)}`; }
  }

  async function deleteTrip(id: string) {
    if (!confirm('Delete this trip?')) return;
    const { error } = await expensesSupabase.from('mileage').delete().eq('id', id);
    if (!error) loadTrips();
  }

  function openEditModal(trip: MileageTrip) {
    setEditingTrip(trip);
    setEditPurpose(trip.purpose || '');
    setEditIsBusiness(trip.is_business);
  }

  async function handleSaveEdit() {
    if (!editingTrip) return;

    const newAmount = editingTrip.distance * editingTrip.rate;
    const { error } = await expensesSupabase
      .from('mileage')
      .update({
        purpose: editPurpose || null,
        is_business: editIsBusiness,
        amount: newAmount
      })
      .eq('id', editingTrip.id);

    if (!error) {
      setEditingTrip(null);
      loadTrips();
    } else {
      console.error('Error updating trip:', error);
      alert('Failed to update trip');
    }
  }

  function exportToCSV() {
    if (filteredTrips.length === 0) { alert('No trips to export'); return; }
    const headers = ['Date', 'Distance (miles)', 'Purpose', 'Type', 'Rate', 'Amount', 'Start Location', 'End Location'];
    const rows = filteredTrips.map(trip => [trip.date, trip.distance.toFixed(2), `"${trip.purpose || 'No purpose'}"`, trip.is_business ? 'Business' : 'Personal', trip.rate.toFixed(2), trip.amount.toFixed(2), `"${trip.start_location || ''}"`, `"${trip.end_location || ''}"`]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = `mileage_${new Date().toISOString().split('T')[0]}.csv`; link.click();
  }

  const formatIdleTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mileage Tracker</h1>
          <p className="text-sm text-gray-600 mt-1">Track business trips with GPS auto-detection</p>
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Types</option>
            <option value="business">Business</option>
            <option value="personal">Personal</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </header>

      {/* Tracking Card */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isNativePlatform ? 'Background GPS Tracking' : 'Auto-Tracking'}
            </h2>
            <p className="text-sm text-gray-600">Automatically starts when you drive over 5 mph</p>
            {isNativePlatform ? (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                Tracks in background - you can close this page
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Keep this page open while driving for tracking</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-blue-600">{currentSpeed.toFixed(1)} mph</p>
            <p className="text-sm text-gray-500">Current Speed</p>
          </div>
        </div>

        {isTracking && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-900">Tracking Active</p>
                <p className="text-green-700 text-2xl font-bold">{distance.toFixed(2)} miles</p>
                <p className="text-sm text-green-600">From: {startLocation || 'Loading...'}</p>
                {idleTime > 60 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Idle: {formatIdleTime(idleTime)} (auto-saves at 15:00)
                  </p>
                )}
              </div>
              <button onClick={() => handleStopTracking(false)} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">Stop & Save Trip</button>
            </div>

            <div className="mt-4 space-y-2">
              <input type="text" placeholder="Trip purpose (optional - can edit later)" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} className="w-4 h-4" /><span className="text-sm">Business trip (can change later)</span></label>
            </div>
          </div>
        )}

        {!isTracking && (<button onClick={() => handleStartTracking()} className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">Start Manual Tracking</button>)}
      </div>

      {/* Tax Deduction Summary Banner */}
      {businessMiles > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💰</span>
                <h3 className="text-lg font-bold">Tax Deduction Tracker</h3>
              </div>
              <p className="text-emerald-100 text-sm">
                Your {businessMiles.toFixed(1)} business miles = <span className="font-bold text-white">${taxDeduction.toFixed(2)}</span> in tax deductions at $0.67/mile (2024 IRS rate)
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">${taxDeduction.toFixed(2)}</p>
              <p className="text-xs text-emerald-200 uppercase tracking-wide">Potential Savings</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            <div className="text-center">
              <p className="text-2xl font-bold">{businessMiles.toFixed(1)}</p>
              <p className="text-xs text-emerald-200">Business Miles</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">$0.67</p>
              <p className="text-xs text-emerald-200">Per Mile Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{filteredTrips.filter(t => t.is_business).length}</p>
              <p className="text-xs text-emerald-200">Business Trips</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4"><p className="text-sm text-gray-600">Total Miles</p><p className="text-2xl font-bold text-gray-900">{totalMiles.toFixed(1)}</p></div>
        <div className="bg-white rounded-xl shadow-sm border p-4"><p className="text-sm text-gray-600">Business Miles</p><p className="text-2xl font-bold text-gray-900">{businessMiles.toFixed(1)}</p></div>
        <div className="bg-white rounded-xl shadow-sm border p-4"><p className="text-sm text-gray-600">Personal Miles</p><p className="text-2xl font-bold text-gray-900">{personalMiles.toFixed(1)}</p></div>
        <div className="bg-white rounded-xl shadow-sm border p-4"><p className="text-sm text-gray-600">Total Amount</p><p className="text-2xl font-bold text-blue-700">${totalAmount.toFixed(2)}</p></div>
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl shadow-sm border border-emerald-200 p-4">
          <p className="text-sm text-emerald-700 font-medium">Tax Deduction</p>
          <p className="text-2xl font-bold text-emerald-600">${taxDeduction.toFixed(2)}</p>
        </div>
      </div>

      {/* Trips Table */}
      {filteredTrips.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-6 text-sm text-gray-500 text-center">No trips recorded yet. Start driving to auto-track your first trip!</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Date</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Distance</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Purpose</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Type</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Amount</th>
                <th className="px-4 py-3 text-left text-emerald-700 font-medium">Tax Deduction</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Route</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((t, idx) => {
                const tripDeduction = t.is_business ? t.distance * 0.67 : 0;
                return (
                  <tr key={t.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-3">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{t.distance.toFixed(2)} mi</td>
                    <td className="px-4 py-3">{t.purpose || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.is_business
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {t.is_business ? 'Business' : 'Personal'}
                      </span>
                    </td>
                    <td className="px-4 py-3">${t.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {t.is_business ? (
                        <span className="font-semibold text-emerald-600">${tripDeduction.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={`${t.start_location || 'Unknown'} → ${t.end_location || 'Unknown'}`}>
                      {t.start_location ? `${t.start_location.split(',')[0]}` : '?'} → {t.end_location ? `${t.end_location.split(',')[0]}` : '?'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(t)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTrip(t.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={exportToCSV} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Export CSV</button>
        <Link href="/dashboard/expenses/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">← Back to Dashboard</Link>
      </div>

      {/* Edit Trip Modal */}
      {editingTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Trip</h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Date</p>
                <p className="font-medium">{new Date(editingTrip.date).toLocaleDateString()}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Distance</p>
                <p className="font-medium">{editingTrip.distance.toFixed(2)} miles</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Route</p>
                <p className="text-sm">{editingTrip.start_location?.split(',')[0] || '?'} → {editingTrip.end_location?.split(',')[0] || '?'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-1 block">Purpose</label>
                <input
                  type="text"
                  value={editPurpose}
                  onChange={(e) => setEditPurpose(e.target.value)}
                  placeholder="e.g., Client meeting, Site visit"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editIsBusiness}
                    onChange={(e) => setEditIsBusiness(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Business trip</span>
                </label>
                {editIsBusiness && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Tax deduction: ${(editingTrip.distance * 0.67).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingTrip(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

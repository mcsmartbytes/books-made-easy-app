import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mcsmartbytes.booksmadeeasy',
  appName: 'Books Made Easy',
  webDir: 'public',
  server: {
    // For development on local network, uncomment and set your IP:
    // url: 'http://YOUR_LOCAL_IP:3000',
    // cleartext: true,
    //
    // For production, deploy to a public URL and set:
    // url: 'https://your-production-url.com',
  },
  plugins: {
    BackgroundGeolocation: {
      license: '',
    },
    Geolocation: {
      // iOS specific permissions
    },
  },
  ios: {
    backgroundColor: '#1e3a5f',
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#1e3a5f',
    allowMixedContent: true,
  },
};

export default config;

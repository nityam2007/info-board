import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.infoboard.app',
  appName: 'Info Board',
  webDir: 'dist',
  server: {
    // For development, you can point to your local server
    // url: 'http://192.168.1.100:3000',
    // cleartext: true
  },
  plugins: {
    // App plugin for handling deep links and share intents
    App: {
      // Enable URL scheme handling
    },
    // Preferences for storing settings
    Preferences: {},
  },
  android: {
    // Allow mixed content for local development
    allowMixedContent: true,
    // Capture share intents
    appendUserAgent: 'InfoBoard-Mobile/1.0',
  },
  ios: {
    // iOS specific config
    contentInset: 'automatic',
  },
};

export default config;

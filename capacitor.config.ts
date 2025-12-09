import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gangyixia.app',
  appName: '纲一下',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wezenstaffing.app',
  appName: 'Wezen Staffing',
  webDir: 'out',
  plugins: {
    Badge: {
      persist: true,
      autoClear: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

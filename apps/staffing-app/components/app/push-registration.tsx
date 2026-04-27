'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiFetch } from '@/lib/api-client';

export function PushRegistration() {
  useEffect(() => {
    async function registerPush() {
      if (!Capacitor.isNativePlatform()) return;

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return;

      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token) => {
        try {
          await apiFetch('/api/users/device-tokens', {
            method: 'POST',
            body: JSON.stringify({
              token: token.value,
              platform: Capacitor.getPlatform(),
            }),
          });
        } catch {
          // Do not block app usage if push registration fails.
        }
      });

      PushNotifications.addListener('registrationError', () => {});
    }

    registerPush();
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiFetch } from '@/lib/api-client';

function routeFromText(text: string) {
  const applicantsMatch = text.match(/\/facility\/applicants\?shiftId=([^\s]+)/);
  if (applicantsMatch?.[1]) {
    return `/app/facility/shift-detail/index.html?shiftId=${encodeURIComponent(applicantsMatch[1])}`;
  }

  const shiftMatch = text.match(/\/facility\/shifts\/([^\s]+)/);
  if (shiftMatch?.[1]) {
    return `/app/facility/shift-detail/index.html?shiftId=${encodeURIComponent(shiftMatch[1])}`;
  }

  return '';
}

function resolveNotificationRoute(data: Record<string, unknown> | undefined, fallbackText = '') {
  const nested =
    data?.data && typeof data.data === 'object'
      ? (data.data as Record<string, unknown>)
      : {};

  const direct = String(
    data?.url ||
      data?.path ||
      data?.deepLink ||
      data?.route ||
      nested.url ||
      nested.path ||
      nested.deepLink ||
      nested.route ||
      ''
  ).trim();

  if (direct.startsWith('/app/')) return direct;

  const requestId = String(data?.requestId || nested.requestId || '').trim();
  if (requestId) {
    return `/app/facility/applicant-detail/index.html?requestId=${encodeURIComponent(requestId)}`;
  }

  const shiftId = String(data?.shiftId || nested.shiftId || '').trim();
  if (shiftId) {
    return `/app/facility/shift-detail/index.html?shiftId=${encodeURIComponent(shiftId)}`;
  }

  return routeFromText(fallbackText);
}

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

      PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        const title = String(event.notification.title || '');
        const body = String(event.notification.body || '');
        const route = resolveNotificationRoute(
          event.notification.data as Record<string, unknown> | undefined,
          `${title}\n${body}`
        );

        if (route) {
          window.location.href = route;
        }
      });
    }

    registerPush();
  }, []);

  return null;
}

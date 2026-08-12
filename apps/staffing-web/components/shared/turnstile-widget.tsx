'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          theme?: 'auto' | 'light' | 'dark';
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  action: string;
  onVerify: (token: string) => void;
  resetKey?: number;
};

export function TurnstileWidget({
  action,
  onVerify,
  resetKey = 0,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile) {
      return;
    }

    if (widgetId) {
      try {
        window.turnstile.remove(widgetId);
      } catch {
        // Ignore stale widget cleanup errors.
      }
    }

    containerRef.current.innerHTML = '';

    const id = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: 'auto',
      callback: (token: string) => {
        onVerify(token);
      },
      'expired-callback': () => {
        onVerify('');
      },
      'error-callback': () => {
        onVerify('');
      },
    });

    setWidgetId(id);
  }, [action, onVerify, siteKey, widgetId]);

  useEffect(() => {
    if (!resetKey || !widgetId || !window.turnstile) return;

    onVerify('');

    try {
      window.turnstile.reset(widgetId);
    } catch {
      // Widget may already have expired or been removed.
    }
  }, [resetKey, widgetId, onVerify]);

  if (!siteKey) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Verification is temporarily unavailable.
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={containerRef} />
    </>
  );
}

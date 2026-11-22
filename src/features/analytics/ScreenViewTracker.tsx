import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';

import { logScreenView } from './ga4';

/**
 * 画面遷移を GA4 の screen_view として送る常駐コンポーネント (表示は持たない)。
 * パスが変わったときだけ発火し、同じパスの再描画では送らない。
 * ルート表記は GA4 側で安定して集計できるよう短い画面名に寄せる。
 */
const SCREEN_NAMES: Record<string, string> = {
  '/': 'home',
  '/phrases': 'phrases',
  '/progress': 'progress',
  '/settings': 'settings',
  '/lesson': 'lesson',
  '/onboarding': 'onboarding',
  '/paywall': 'paywall',
  '/legal': 'legal',
};

export function ScreenViewTracker(): null {
  const pathname = usePathname();
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === lastSentRef.current) {
      return;
    }
    lastSentRef.current = pathname;
    logScreenView(SCREEN_NAMES[pathname] ?? pathname);
  }, [pathname]);

  return null;
}

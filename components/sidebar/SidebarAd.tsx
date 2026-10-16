'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT, ADS_ENABLED } from '@/lib/ads';

/** AdSense display unit id for the post sidebar (build-time, like lib/ads.ts). */
const SLOT = (process.env.NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT || '').trim();

/**
 * Sidebar display ad, the bestlooking.skin sidebar's ad block. Renders nothing
 * unless ads are switched on (lib/ads.ts) and NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT
 * names a unit, so the placement can ship before AdSense approval without an
 * empty "Advertisement" box. adsbygoogle.js is loaded by HeadScripts.
 */
export default function SidebarAd({ className = '' }: { className?: string }) {
  const pushed = useRef(false);
  const active = ADS_ENABLED && /^\d+$/.test(SLOT);

  useEffect(() => {
    if (!active || pushed.current) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      /* Blocked by an ad blocker or already filled: nothing to do. */
    }
  }, [active]);

  if (!active) return null;
  return (
    <aside aria-label="Advertisement" className={className}>
      <span className="mb-2 block text-center text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
        Advertisement
      </span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

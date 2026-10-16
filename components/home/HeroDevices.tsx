import { responsiveImg } from '@/lib/image';

/**
 * Home hero illustration (user request, 17 Oct 2026): a smart home hub with
 * the devices it connects, on a light background in both themes. Real product
 * photos from the catalogue in labelled tiles, joined to the hub by lines
 * whose dashes flow towards it (static under prefers-reduced-motion).
 *
 * Positions are percentages of the frame, so the same layout works on the
 * wide desktop frame and the tall phone frame; the bottom band is left clear
 * for the "Written for Australia" caption. Styles: .ht-devices in globals.css.
 */

type Device = { label: string; src: string; x: number; y: number };

const HUB = { label: 'Smart home hub', src: '/images/products/aqara-hub-m100.webp', x: 50, y: 44 };
const DEVICES: Device[] = [
  { label: 'Smart bulb', src: '/images/products/tp-link-tapo-b22-multicolour-bulb.webp', x: 19, y: 15 },
  { label: 'Video doorbell', src: '/images/products/tp-link-tapo-d210-2k-video-doorbell-camera.webp', x: 81, y: 15 },
  { label: 'Smart plug', src: '/api/media/file/tp-link-tapo-p110-smart-plug-with-energy-monitoring.webp', x: 14, y: 46 },
  { label: 'Smart lock', src: '/images/products/aqara-a100-smart-door-lock.webp', x: 86, y: 46 },
  { label: 'Smart speaker', src: '/api/media/file/amazon-echo-dot-5th-gen-smart-speaker.webp', x: 26, y: 72 },
  { label: 'Robot vacuum', src: '/images/products/ecovacs-deebot-t80s-omni-robot-vacuum-mop.webp', x: 74, y: 72 },
];

export default function HeroDevices() {
  return (
    <div className="ht-devices" role="img" aria-label="A smart home hub connected to a smart bulb, video doorbell, smart plug, smart lock, smart speaker and robot vacuum">
      <svg className="ht-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {DEVICES.map((d) => (
          <line key={d.label} x1={d.x} y1={d.y} x2={HUB.x} y2={HUB.y} />
        ))}
      </svg>
      {DEVICES.map((d) => (
        <span key={d.label} className="ht-device" style={{ left: `${d.x}%`, '--y': d.y } as React.CSSProperties} aria-hidden="true">
          <span className="ht-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...responsiveImg(d.src, 128, '128px')} alt="" width={128} height={128} loading="lazy" />
          </span>
          <span className="ht-label">{d.label}</span>
        </span>
      ))}
      <span className="ht-device ht-hub" style={{ left: `${HUB.x}%`, '--y': HUB.y } as React.CSSProperties} aria-hidden="true">
        <span className="ht-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...responsiveImg(HUB.src, 160, '160px')} alt="" width={160} height={160} fetchPriority="high" />
        </span>
        <span className="ht-label">{HUB.label}</span>
      </span>
    </div>
  );
}

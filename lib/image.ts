/**
 * Responsive attributes for a raw <img>, served through Next's image optimiser
 * (/_next/image: resized, WebP, cached a year; next.config.mjs `images`).
 *
 * Covers come from the CMS as 1024-1240px JPEGs and were sent at full size into
 * 70px thumbnails and 300px cards (audit perf #2: ~600 KiB a page). Spread the
 * result onto the element:
 *
 *   <img {...responsiveImg(coverFor(article), 640, '(max-width: 640px) 100vw, 33vw')} alt="" ... />
 *
 * `max` is the widest the image is ever displayed, in CSS pixels; the srcset
 * runs up to twice that for high-density screens. `sizes` tells the browser
 * how wide it is shown, so it can pick the smallest file that is sharp enough.
 *
 * Left untouched: SVGs, data URIs, other sites' images (only the CMS uploads
 * host is allowed in next.config.mjs), and the static preview export, which
 * has no server to resize anything.
 */

// Widths the optimiser accepts: Next's default imageSizes and deviceSizes.
const WIDTHS = [64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];
const UNOPTIMISED = process.env.NEXT_PUBLIC_IMAGES_UNOPTIMISED === '1';

function optimisable(src: string): boolean {
  if (UNOPTIMISED || !src || src.startsWith('data:') || /\.svg(\?|$)/i.test(src)) return false;
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  return src.startsWith('https://nxtsmarthome.com.au/');
}

// Trailing slash: trailingSlash is on, and /_next/image without it 308-redirects.
const url = (src: string, w: number) => `/_next/image/?url=${encodeURIComponent(src)}&w=${w}&q=75`;

export function responsiveImg(
  src: string | undefined | null,
  max: number,
  sizes: string,
): { src: string; srcSet?: string; sizes?: string } {
  const value = src ?? '';
  if (!optimisable(value)) return { src: value };
  const widths = WIDTHS.filter((w) => w <= max * 2);
  const base = WIDTHS.find((w) => w >= max) ?? WIDTHS[WIDTHS.length - 1];
  if (!widths.includes(base)) widths.push(base);
  return {
    src: url(value, base),
    srcSet: widths.map((w) => `${url(value, w)} ${w}w`).join(', '),
    sizes,
  };
}

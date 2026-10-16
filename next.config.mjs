import { withPayload } from '@payloadcms/next/withPayload';
import fs from 'node:fs';

/** @type {import('next').NextConfig} */
// The preview build is served from /preview/, so its assets need that prefix.
const basePath = process.env.PREVIEW_BASE_PATH || '';

// Production runs as a Node server (`next start`, nxtsmarthome-com-au.service on
// 127.0.0.1:3013) so Strapi content refreshes by ISR without a rebuild. The
// /preview/ build is still a static export, published by scripts/deploy-preview.sh.
const staticExport = Boolean(basePath) || process.env.STATIC_EXPORT === '1';

/*
 * Permanent redirects for removed or merged URLs, from data/redirects-adsense.json
 * ([{ from, to, reason }]). nginx serves the same rules first (scripts/gen-redirects.mjs
 * writes them into public/_redirects.map); these cover requests that reach Next
 * directly. Both slash forms are listed, so neither takes an extra trailing-slash hop.
 * A static export cannot redirect, so the preview build skips them.
 */
function adsenseRedirects() {
  const file = new URL('./data/redirects-adsense.json', import.meta.url);
  if (!fs.existsSync(file)) return [];
  const rules = JSON.parse(fs.readFileSync(file, 'utf8'));
  return rules.flatMap(({ from, to }) => {
    const bare = from.replace(/\/+$/, '');
    return [
      { source: bare, destination: to, permanent: true },
      { source: `${bare}/`, destination: to, permanent: true },
    ];
  });
}

const nextConfig = {
  experimental: { cpus: 2 },
  // No "x-powered-by: Next.js" header (audit L2): it only advertises the stack.
  poweredByHeader: false,
  ...(staticExport ? { output: 'export' } : {}),
  // deploy.sh builds into a side directory while the live server keeps running,
  // then swaps it in. Unset, this is the normal .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  trailingSlash: true,
  // lib/image.ts reads this: the static preview export has no image optimiser.
  env: { NEXT_PUBLIC_IMAGES_UNOPTIMISED: staticExport ? '1' : '' },
  images: {
    // The live server resizes and converts images (sharp): covers from the CMS
    // were served as 1024px JPEGs into 300px slots (audit perf #2, ~600 KiB a
    // page). Only the static preview export, which has no server, needs raw files.
    unoptimized: staticExport,
    formats: ['image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'nxtsmarthome.com.au', pathname: '/uploads/**' }],
    // CMS uploads and covers are content-hashed or versioned (?v=): cache a year.
    minimumCacheTTL: 31536000,
  },
  ...(staticExport
    ? {}
    : {
        redirects: async () => [
          ...adsenseRedirects(),
          // The topics index moved from /categories/ (6 Oct 2026); /categories/<slug>/ is unchanged.
          { source: '/categories', destination: '/all-topics/', permanent: true },
          { source: '/categories/', destination: '/all-topics/', permanent: true },
          // Generated article text sometimes links /product/<slug> (singular),
          // which 404s; the pages live at /products/<slug>/ (AdSense Task 10).
          { source: '/product/:slug', destination: '/products/:slug/', permanent: true },
          { source: '/product/:slug/', destination: '/products/:slug/', permanent: true },
        ],
      }),
};

export default withPayload(nextConfig);

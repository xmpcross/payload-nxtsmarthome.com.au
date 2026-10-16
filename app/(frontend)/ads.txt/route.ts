/**
 * /ads.txt, built from NEXT_PUBLIC_ADSENSE_CLIENT so it can never disagree with
 * the publisher id the page loads (components/HeadScripts.tsx).
 *
 * ads.txt wants the id without the "ca-" prefix. f08c47fec0942fa0 is Google's
 * fixed certification authority id, the same for every publisher.
 *
 * Unset or malformed: 404 with no-store, so Cloudflare does not keep serving a
 * cached 404 after the id is set. nginx passes /ads.txt through to Next like
 * any other path (deploy/nginx/snippets/nxtsmarthome-site.conf).
 */
import { ADSENSE_CLIENT } from '@/lib/ads';

// Served whenever the publisher id is set, including before approval: Google
// checks ads.txt during review. It authorises ads; it does not show any.
export const dynamic = 'force-dynamic';

export function GET() {
  const client = ADSENSE_CLIENT;
  if (!client) {
    return new Response('Not found\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const publisher = client.replace(/^ca-/, '');
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

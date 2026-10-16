import { VIGLINK_KEY } from '@/lib/affiliate';

/**
 * Sovrn Commerce (VigLink) affiliate script, rendered at the end of <body>.
 * The snippet lives in public/js/viglink-init.js and reads the key from
 * data-key, so the page carries a single <script src> (an inline script would
 * also be repeated in the React payload). Off when VIGLINK_KEY is empty.
 */
export default function VigLink() {
  if (!VIGLINK_KEY) return null;
  return <script src="/js/viglink-init.js" data-key={VIGLINK_KEY} async />;
}

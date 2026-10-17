'use client';

import { VIGLINK_KEY } from '@/lib/affiliate';

/**
 * Sovrn Commerce (VigLink) affiliate script, rendered at the end of <body>.
 * Sovrn's "Check your installation" looks for their snippet text in the page
 * HTML, so it is inlined exactly as they give it (an external <script src> was
 * reported "Code was not found on page"). Off when VIGLINK_KEY is empty.
 *
 * A client component on purpose: rendered from a server component, the script
 * text is also serialised into Next's page-data JSON (self.__next_f), and
 * Sovrn's checker counts that copy as a second install ("Multiple instances of
 * the code were found"). Here the page data holds only a component reference,
 * so the snippet appears once, in the HTML.
 */
export default function VigLink() {
  if (!VIGLINK_KEY) return null;
  const snippet = `
  var vglnk = {key: '${VIGLINK_KEY}'};
  (function(d, t) {var s = d.createElement(t);
    s.type = 'text/javascript';s.async = true;
    s.src = '//cdn.viglink.com/api/vglnk.js';
    var r = d.getElementsByTagName(t)[0];
    r.parentNode.insertBefore(s, r);
  }(document, 'script'));
`;
  return <script type="text/javascript" dangerouslySetInnerHTML={{ __html: snippet }} />;
}

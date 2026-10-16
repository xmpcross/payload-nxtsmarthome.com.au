// Content rules for articles the ai-writer-cli generates for nxtsmarthome.com.au.
//
// They come from the site's own rules (projects/nxtsmarthome.com.au/CLAUDE.md)
// and the 6 October 2026 SEO audit
// (projects/nxtsmarthome.com.au/reports/nxtsmarthome.com.au-audit/):
//   S1     in-body links used the category key (/security/...) and 308-redirected;
//          18 articles had no contextual inbound links
//   S4/S5  titles over 60 characters, descriptions over 160
//   GEO-4  answers arriving after the intro; statement H2s instead of questions
//   C7     the 24 Sep - 5 Oct batch averaged 30-word sentences, no short answer
//   GEO-1  legal and safety claims with no source; C6 "or checked by an
//          electrician" contradicting /about
//   GEO-6  comparison and buying guides without a comparison table
//   C3     near-duplicate articles splitting one search intent
//   C10    guides labelled "reviews" on a site that has published none
// and the 17 October 2026 audit (nxtsmarthome.com.au-audit/findings/):
//   H2/C3  an article body stored with JSON-escaped hrefs (\"https:/...\") and
//          legacy /security/ prefixes, which crawled as 404s
//   CQ2    legal and safety articles with no Sources section
//   CQ3    titles promising figures or a named programme the body never gives
//   CQ5    non-AU product variants (EU switch, US plug) placed in articles
//   CQ9    58 of 84 articles with no question-form H2
//   GEO-3  no comparison tables on "vs" and "best" pages
//   rule 8 the same generic hubs boxed in unrelated articles (kitchen, bedroom,
//          nursery, garage): a product box needs the product named in the text
//
// generate-site-post.js uses this module when site.contentRules is
// 'nxtsmarthome': the rules go into the prompt, research comes from web
// search (researchJson), internal links are rewritten to canonical URLs, and
// checkNxtsmarthomeContent() decides whether the article may be published.
// An article with problems is still saved, as a draft, with the problems
// printed for the editor.

export const TITLE_MAX = 60; // seoTitle; the H1 (title) may run longer
export const META_DESCRIPTION_MIN = 120;
export const META_DESCRIPTION_MAX = 155;
export const SHORT_ANSWER_WORDS = [40, 60];
export const SENTENCE_MAX = 30;
export const INTERNAL_LINKS_MIN = 2;
// CQ9/GEO-4: question-form H2s. At least QUESTION_H2_MIN, or QUESTION_H2_SHARE
// of the H2s if that is fewer, never below 1.
export const QUESTION_H2_MIN = 3;
export const QUESTION_H2_SHARE = 0.4;
// GEO-3: a title that sets up a comparison needs a table, whatever the post type.
export const COMPARISON_TITLE = /\b(?:best|vs\.?|versus|compare|comparison|buying guide|top \d+)\b/i;
export const PRODUCT_BOXES_MIN = 2;
export const ALT_MAX = 125;

export const SITE_ORIGIN = 'https://nxtsmarthome.com.au';

// Strapi category slug (the site's category key) -> URL slug. lib/site.ts.
export const CATEGORY_URL_SLUG = {
  security: 'security-and-cameras',
  'smart-door-locks': 'smart-door-locks',
  lighting: 'lighting',
  energy: 'energy-and-solar',
  entertainment: 'entertainment-and-audio',
  climate: 'climate-and-comfort',
  'hubs-and-platforms': 'hubs-and-platforms',
  'robot-vacuums': 'robot-vacuums',
  'setup-guides': 'setup-guides',
  'buying-guides': 'buying-guides',
};

export const HYPE_PHRASES = [
  'elevate', 'peace of mind', 'game-changer', 'game changer', 'revolutionise', 'revolutionary',
  'seamless', 'seamlessly', 'cutting-edge', 'next level', 'next-level', 'look no further', 'in conclusion',
  'in today\'s', 'whether you\'re a', 'dive into', 'delve', 'tapestry', 'supercharge', 'effortless',
];

// Lowercase only: capitalised "Color" is Philips Hue product naming (White and Color Ambiance).
const US_SPELLING = /\b(color|colors|colored|optimize[sd]?|optimizing|center|centers|analyze[sd]?|favorite|behavior|gray|aluminum|organize[sd]?|customize[sd]?|meters? (?:away|long|wide|high))\b/;
const TESTING = /\b(?:we|I) (?:tested|have tested|trialled)\b|\bwe (?:found|noticed|loved|liked|measured)\b|\bin (?:our|my) (?:testing|tests|experience|hands-on)\b|\bhands-on (?:test|review|testing)\b|\bour (?:testing|lab|review unit)\b/i;
// "1/10 HP" is a motor rating, not a score.
const RATING = /\b\d(?:\.\d)?\s?(?:\/\s?(?:5|10)\b(?!\s?(?:HP|hp|A|W|V|mm|cm))|out of (?:5|10)\b|stars?\b)|★/i;
const OR_CHECKED = /\b(?:done|carried out|installed),? or (?:at least )?checked,? by an? (?:licensed )?electrician/i;
const LAW_AS_SETTLED = /\b(?:it is|it's) (?:illegal|legal|against the law)\b|\bthe law (?:says|requires|states)\b|\byou (?:are|'re) (?:legally|not legally) (?:required|allowed)\b/i;
const LEGAL_TOPIC = /\b(?:licensed electrician|fixed wiring|hard-?wir(?:e|ed|ing)|switchboard|AS\/NZS|surveillance|privacy act|recording audio|landlord|tenan(?:t|cy)|strata|lease)\b/i;
const OFFICIAL_SOURCE = /https?:\/\/[^\s)]*(?:\.gov\.au|esv\.vic\.gov\.au|oaic\.gov\.au|fairtrading\.nsw\.gov\.au|worksafe|electricalsafety|standards\.org\.au|accc\.gov\.au|energy\.gov\.au|esafety\.gov\.au)/i;
// A retailer price claim ("$99 at JB Hi-Fi"); a general figure ("a $20 smart plug") is fine.
const PRICE = /(?:A?\$|AUD\s?)\s?\d[\d,]*(?:\.\d\d)?\s+(?:at|from)\s+(?:[A-Z][\w&-]*)/;
const TITLE_BANNED = /!!|\b(?:tested|hands-on|honest|ultimate|best ever|verified|review(?:ed|s)?)\b/i;
const EDITORIAL_MARKERS = /\[VERIFY|\bTODO\b|\bTBD\b|\blorem\b/i;
// CQ2: an article whose title or headings are about electrical work, privacy and
// surveillance, or tenancy needs a Sources section with official or
// manufacturer pages, not just a passing regulator link.
const LEGAL_HEADING = /\b(?:electric(?:al|ian)s?|wiring|hard-?wir(?:e|ed|ing)|switchboard|privacy|surveillance|record(?:ing)? (?:audio|neighbours?)|laws?|legal(?:ly)?|landlords?|tenan(?:t|ts|cy)|renters?|rental|strata|lease)\b/i;
export const SOURCES_MIN_LEGAL = 2;
// Not sources: this site, and the affiliate retailers and link wrappers.
const NOT_A_SOURCE = /^https?:\/\/(?:[^/]*\.)?(?:nxtsmarthome\.com\.au|amazon\.com(?:\.au)?|ebay\.com(?:\.au)?|jbhifi\.com\.au|thegoodguys\.com\.au|officeworks\.com\.au|bunnings\.com\.au|harveynorman\.com\.au|binglee\.com\.au|kogan\.com|bigw\.com\.au|geni\.us|amzn\.to)(?:[/:?#]|$)/i;
// CQ3: a title that promises figures ("Real Numbers", "how much", cost, price,
// savings) needs figures in the body, and must not be followed by a body that
// declines to give them.
const TITLE_FIGURES = /\b(?:real|actual|exact|true)\s+(?:numbers|figures|costs?|prices?|savings)\b|\bhow much\b|\bcosts?\b|\bprices?\b|\bsavings?\b|\bunder \$\d/i;
const FIGURE = /(?:A?\$|AUD\s?)\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:%|c\/kWh|kWh|cents?\b|watts?\b|W\b)/g;
export const TITLE_FIGURES_MIN = 3;
const FIGURE_REFUSAL = /\b(?:won't|will not|can't|cannot|doesn't|does not|don't|do not) (?:quote|give|provide|list|state|publish) (?:any )?(?:specific |exact |precise |single )?(?:dollar )?(?:figures?|numbers?|prices?|amounts?|costs?)\b|\bno (?:reliable|single|exact|precise) (?:single )?(?:[\w-]+ )?(?:figure|number|price|cost)\b|\brather than chasing an exact price\b/i;
// CQ3: "Home Battery Rebate 2026": a year plus a programme word in the title
// needs the body to name the actual programme (a capitalised name ending in
// Program, Scheme, Rebate...), beyond the title's own words.
const TITLE_PROGRAMME = /\b(?:rebates?|programs?|programmes?|schemes?|grants?|subsid(?:y|ies)|incentives?)\b/i;
const PROGRAMME_NAME = /\b(?:[A-Z][\w'’-]*\s+){1,6}(?:Program|Programme|Scheme|Rebate|Initiative|Grant|Fund|Incentive)s?\b/g;

export const NXTSMARTHOME_RULES = `# NXT Smart Home editorial rules (site rules + October 2026 SEO audit)

These articles are live editorial claims on an Australian affiliate site. An
article that breaks these rules is held back as a draft, so follow them exactly.

Facts and honesty
- State only what the research notes confirm, or what is common, stable
  knowledge (what Zigbee is, how a smart plug works). Confirm every model
  name, spec, compatibility claim, warranty and figure in the notes; leave out
  anything you cannot confirm.
- Never construct a URL. Link only to URLs that appear in the research notes or
  the internal-link list.
- We have not tested these products. No "we tested", "we found", "in our
  testing", "in our experience", "hands-on"; no star ratings or scores; never
  call the article a review.
- Prices: none, unless the research notes give one with its retailer, and then
  attributed and dated ("JB Hi-Fi listed it at $99 in October 2026").

Legal and safety (electrical work, privacy and surveillance, tenancy and strata)
- Never state the law as settled. Say what the official source says and link
  to it from the research notes (state electrical safety regulator, OAIC,
  state tenancy authority), or point readers to it.
- Fixed wiring: "must be done by a licensed electrician" and point to the state
  regulator. Never "done or checked by an electrician".

Structure
- Open with a 40-60 word direct answer to the question in the title, as a plain
  paragraph before the first heading. Answer it outright; do not introduce the
  topic.
- Question-form H2s: at least ${QUESTION_H2_MIN} of the H2s (or ${Math.round(QUESTION_H2_SHARE * 100)}% of them if
  that is fewer; Sources and FAQ do not count) are questions a reader would
  ask ("Can I install a smart switch myself?"), not labels ("The rule,
  plainly"). Keep the rest as plain labels; no more than about half questions.
- Keep sentences under ${SENTENCE_MAX} words. Short paragraphs.
- Comparison, buying-guide and roundup articles, and any article whose title
  says best, vs, versus, compare, comparison, buying guide or "top N", include
  a Markdown comparison table near the top, using only figures the research
  notes confirm; leave a cell as "Not stated" rather than guess.
- Product boxes: place a catalogue product only where the article genuinely
  discusses that kind of product. Never add a sentence or section just to
  mention one (a security camera in a smoke-alarm article is an ad, not
  content, CLAUDE.md rule 3). Name each boxed product (brand and model) in the
  prose before its box; a box for a product the text never names is removed.
  Placing none is better than placing one that does not belong; the editor
  then finds a product or holds the article.
- "Best X", buying-guide, roundup and comparison articles: name the shortlist
  early. Within the first third of the article, a short "Our shortlist" style
  section (an H2) gives each catalogue product a one-line who-it-suits, with its
  product box, before the long explanation. That is what ranks for "best X
  australia" (audit SXO P1/P2).
- Link 2-4 related NXT Smart Home articles from the internal-link list, with
  descriptive anchor text, where they genuinely help. Use the URLs exactly.
- End with "## Sources": the official and manufacturer pages from the research
  notes that the article relies on, as a Markdown list of links. Electrical,
  privacy/surveillance and tenancy articles need at least ${SOURCES_MIN_LEGAL} (regulator,
  OAIC, state tenancy authority, manufacturer); retailers do not count.
- Links: plain Markdown [text](url) with full canonical URLs. Never escape
  quotes, never write raw HTML anchors.

Titles and metadata
- seoTitle at most ${TITLE_MAX} characters, none of "tested",
  "hands-on", "honest", "ultimate", "verified", "review".
- The title (H1) may be longer, but keep it plain and specific.
- The title promises only what the body delivers: no "Real Numbers", cost or
  price title unless the body gives dated, sourced figures; no year plus
  "rebate" or "program" unless the body names the programme and links it.
- seoDescription ${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX} characters, plain text, describing what the article
  actually covers.

Style
- Australian English: colour, optimise, centre, analyse, licence (noun), metre.
- Plain and specific. None of: ${HYPE_PHRASES.join(', ')}.
- No keyword stuffing; never promise rankings or results.`;

/** Research brief for researchJson(): what to confirm before writing. */
export function researchPrompt(topic, categoryLabel) {
  return `Research this NXT Smart Home article before it is written: "${topic}" (category: ${categoryLabel}).
The readers are Australian homeowners and renters. Use web search to confirm:
- the products, models and platforms the article will name: key specs, Australian availability, Matter / Apple Home / Google Home / Alexa / SmartThings / Home Assistant support, 2.4GHz needs, subscriptions, Australian warranty
- any electrical, privacy or tenancy point the topic touches, from the official Australian source (state electrical safety regulator, OAIC, state tenancy authority)
- Australian specifics: plug and voltage, RCM, local retailers that stock it
Prefer manufacturer Australian pages, Australian retailers and .gov.au sources.
Return only what you confirmed, each with the URL it came from. No prices unless a retailer page states one; then include the retailer and date.`;
}

export const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { fact: { type: 'string' }, url: { type: 'string' } },
        required: ['fact', 'url'],
        additionalProperties: false,
      },
    },
    officialSources: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, url: { type: 'string' } },
        required: ['name', 'url'],
        additionalProperties: false,
      },
    },
  },
  required: ['facts', 'officialSources'],
  additionalProperties: false,
};

export function researchNotes(research) {
  const facts = (research?.facts ?? []).map((f) => (f.url ? `- ${f.fact} (${f.url})` : `- ${f.fact}`)).join('\n');
  const official = (research?.officialSources ?? []).map((s) => `- ${s.name}: ${s.url}`).join('\n');
  return `\n\nResearch notes (web search, ${new Date().toISOString().slice(0, 10)}). The only specific facts you may use:\n${facts || '- (none confirmed)'}\n\nSource pages found (the ONLY external URLs you may link, copied exactly, character for character; never shorten one to its homepage or guess a path):\n${official || '- (none found)'}\n`;
}

/** Canonical URL of an article: category URL slug, trailing slash. */
export function articleUrl(categoryKey, slug) {
  const cat = CATEGORY_URL_SLUG[categoryKey] || categoryKey;
  return `${SITE_ORIGIN}/${cat}/${slug}/`;
}

/**
 * Rewrites links to the site's own articles to their canonical form (S1): the
 * category key becomes the URL slug and a trailing slash is added, absolute or
 * relative. /security/x -> /security-and-cameras/x/.
 */
export function canonicaliseInternalLinks(markdown) {
  const keys = Object.keys(CATEGORY_URL_SLUG).sort((a, b) => b.length - a.length).map((k) => k.replace(/[-]/g, '\\-'));
  const re = new RegExp(`\\]\\((?:https?://(?:www\\.)?nxtsmarthome\\.com\\.au)?/(${keys.join('|')})/([a-z0-9-]+)/?(#[^)\\s]*)?\\)`, 'g');
  return String(markdown).replace(re, (_, cat, slug, hash = '') => `](${articleUrl(cat, slug)}${hash})`);
}

/** Internal article links in the body, canonical form. */
export function internalLinks(markdown) {
  const out = new Set();
  for (const m of String(markdown).matchAll(/\]\((https?:\/\/(?:www\.)?nxtsmarthome\.com\.au\/[a-z0-9-]+\/[a-z0-9-]+\/)\)/g)) out.add(m[1]);
  return [...out];
}

/**
 * A URL the research returned, or the homepage of a site it returned (the
 * model links "https://www.energysafe.vic.gov.au" for a regulator it found a
 * deep page of). Deep paths must match exactly: those are the ones that get
 * invented.
 */
export function isAllowedUrl(url, allowedUrls) {
  const n = normaliseUrl(url);
  if (allowedUrls.has(n)) return true;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.pathname.replace(/\/+$/, '') !== '' || u.search) return false;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  for (const a of allowedUrls) {
    try {
      if (new URL(a).hostname.replace(/^www\./, '') === host) return true;
    } catch {}
  }
  return false;
}

/*
 * Adds to allowedUrls every external link in the text that the research did
 * not list but that loads (HTTP 200 after redirects). Gemini's grounding data
 * lists only some of the pages it read, and the model links real official
 * pages it found (a state tenancy authority's smoke-alarm page); invented URLs
 * almost always 404. A site that refuses the check (403) stays unlinked.
 */
export async function verifyLiveUrls(markdown, allowedUrls, { timeoutMs = 10000 } = {}) {
  const urls = [...new Set(String(markdown).replace(/`[^`\n]*`/g, ' ').match(/https?:\/\/[^\s)\]"'>`]+/g) ?? [])]
    .filter((u) => !/^https?:\/\/(?:www\.)?nxtsmarthome\.com\.au\//i.test(u) && !isAllowedUrl(u, allowedUrls))
    .filter((u) => !/^https?:\/\/(?:[^/]*\.local\b|localhost\b|\[|(?:10|127|192\.168)\.)/i.test(u));
  const live = [];
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; NXTSmartHome-linkcheck/1.0)' },
      });
      if (res.ok) {
        allowedUrls.add(normaliseUrl(url));
        live.push(url);
      }
    } catch {}
  }));
  return live;
}

/** Turns links to URLs the research did not return into plain text (anchor kept). */
export function unlinkUnsourced(markdown, allowedUrls) {
  const dropped = [];
  const text = String(markdown).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, anchor, url) => {
    if (/^https?:\/\/(?:www\.)?nxtsmarthome\.com\.au\//i.test(url) || isAllowedUrl(url, allowedUrls)) return m;
    dropped.push(url);
    return anchor;
  });
  // A Sources list item left with no link is no longer a source.
  return { text: text.replace(/^\s*[-*]\s+[^\[\n]*$\n?/gm, (line) => (/^\s*[-*]\s+\S/.test(line) && inSources(text, line) ? '' : line)), dropped };
}

function inSources(text, line) {
  const at = text.indexOf(line);
  const sources = text.search(/^##\s+Sources\s*$/im);
  return sources >= 0 && at > sources;
}

export function normaliseUrl(url) {
  return String(url).replace(/[.,;:]+$/, '').replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
}

function words(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

function excerpt(text, at, len) {
  return text.slice(Math.max(0, at - 30), at + len + 30).replace(/\s+/g, ' ').trim();
}

/** Prose only: no tables, link targets, headings or list markers. */
function prose(markdown) {
  return String(markdown)
    .split('\n')
    .filter((l) => !/^\s*\|/.test(l) && !/^\s*#/.test(l) && !/^::product:/.test(l.trim()))
    .join('\n')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/[[\]*_`]/g, '');
}

function sentences(text) {
  return prose(text)
    .split(/\n+/)
    .flatMap((p) => p.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/))
    .map((s) => s.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').trim())
    .filter((s) => words(s) >= 3);
}

/**
 * Checks a generated article against the rules. Returns a list of problems;
 * empty means it may be published.
 *
 *   post         { title, seoTitle, seoDescription, content, postType, faq? }
 *   allowedUrls  Set of normalised external URLs the research returned
 */
export function checkNxtsmarthomeContent(post, { allowedUrls = null } = {}) {
  const issues = [];
  const body = String(post.content || '');
  const faqText = (post.faq || []).map((f) => `${f.question} ${f.answer}`).join(' ');
  const all = `${post.title}\n${body}\n${faqText}`;

  if (post.seoTitle && post.seoTitle.length > TITLE_MAX) issues.push(`seoTitle is ${post.seoTitle.length} characters (max ${TITLE_MAX})`);
  for (const [label, t] of [['title', post.title], ['seoTitle', post.seoTitle]]) {
    const m = String(t || '').match(TITLE_BANNED);
    if (m) issues.push(`${label} contains "${m[0]}"`);
  }
  const dl = String(post.seoDescription || '').length;
  if (dl < META_DESCRIPTION_MIN || dl > META_DESCRIPTION_MAX) issues.push(`seoDescription is ${dl} characters (want ${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX})`);

  // GEO-4: a direct answer before the first heading.
  const lead = body.split(/\n#{2,3}\s/)[0].split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !p.startsWith('::product:'))[0] || '';
  const leadWords = words(prose(lead));
  if (leadWords < SHORT_ANSWER_WORDS[0] - 5 || leadWords > SHORT_ANSWER_WORDS[1] + 15) {
    issues.push(`opening answer is ${leadWords} words (want ${SHORT_ANSWER_WORDS[0]}-${SHORT_ANSWER_WORDS[1]}, before the first heading)`);
  }

  // C7: long sentences.
  const ss = sentences(body);
  const long = ss.filter((s) => words(s) > SENTENCE_MAX + 5);
  const avg = ss.length ? ss.reduce((n, s) => n + words(s), 0) / ss.length : 0;
  if (avg > 22) issues.push(`average sentence is ${avg.toFixed(1)} words (want 22 or fewer)`);
  if (long.length > 3) issues.push(`${long.length} sentences over ${SENTENCE_MAX + 5} words, e.g. "${long[0].slice(0, 90)}..."`);

  // GEO-4/CQ9: question-form H2s.
  const h2 = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]).filter((h) => !/^(sources|frequently asked questions|faqs?)$/i.test(h.trim()));
  if (h2.length) {
    const want = questionH2Required(h2.length);
    const have = h2.filter((h) => /\?\s*$/.test(h.replace(/\*+/g, ''))).length;
    if (have < want) issues.push(`${have} of ${h2.length} H2s are questions (want at least ${want})`);
  }

  // S1: internal links.
  const links = internalLinks(body);
  if (links.length < INTERNAL_LINKS_MIN) issues.push(`${links.length} internal article links (want ${INTERNAL_LINKS_MIN}-4)`);
  if (/\]\(\/(?:security|energy|entertainment|climate)\//.test(body)) issues.push('internal link uses a category key path (redirects)');

  // SXO P1/P2: the product shortlist comes early, not after the explainer.
  if (['product-comparison', 'buying-guide', 'product-roundup'].includes(post.postType || '')) {
    const first = body.search(/::product:[a-z0-9-]+::/);
    if (first >= 0 && first > body.length / 3) issues.push(`first product box is ${Math.round((first / body.length) * 100)}% of the way down (want the shortlist in the first third)`);
  }

  // GEO-6/GEO-3: comparison table for comparison-type articles, and for any
  // title that sets up a comparison ("best", "vs", "top 5").
  const type = post.postType || '';
  const titleCue = `${post.title || ''}\n${post.seoTitle || ''}`.match(COMPARISON_TITLE);
  if (!hasMarkdownTable(body)) {
    if (['product-comparison', 'buying-guide', 'product-roundup'].includes(type)) issues.push(`no comparison table (${type})`);
    else if (titleCue) issues.push(`no comparison table (title says "${titleCue[0]}")`);
  }

  // Sources and URL provenance.
  if (!/^##\s+Sources\s*$/im.test(body)) issues.push('no "## Sources" section');
  if (allowedUrls) {
    // Local addresses a reader types during setup (homeassistant.local:8123,
    // 192.168.x.x, a [placeholder]) are instructions, not cited sources.
    const cited = body.replace(/`[^`\n]*`/g, ' ');
    for (const url of cited.match(/https?:\/\/[^\s)\]"'>`]+/g) ?? []) {
      if (/^https?:\/\/(?:[^/]*\.local\b|localhost\b|\[|(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.)/i.test(url)) continue;
      if (/^https?:\/\/(?:www\.)?nxtsmarthome\.com\.au\//i.test(url)) continue;
      if (!isAllowedUrl(url, allowedUrls)) issues.push(`URL not from research: ${url}`);
    }
  }

  // Rules 5 and 6: testing, ratings, legal claims.
  for (const [label, re] of [
    ['testing claim', TESTING], ['star rating or score', RATING], ['"or checked by an electrician" (C6)', OR_CHECKED],
    ['law stated as settled', LAW_AS_SETTLED], ['editorial marker', EDITORIAL_MARKERS],
  ]) {
    const m = all.match(re);
    if (m) issues.push(`${label}: "${excerpt(all, m.index, m[0].length)}"`);
  }
  if (LEGAL_TOPIC.test(body) && !OFFICIAL_SOURCE.test(body)) {
    issues.push('covers electrical, privacy or tenancy rules but links no official (.gov.au or regulator) source (GEO-1)');
  }
  const headings = [post.title, post.seoTitle, ...[...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1])].join('\n');
  if (LEGAL_HEADING.test(headings)) {
    const n = sourceLinks(body).length;
    if (n < SOURCES_MIN_LEGAL) {
      issues.push(`electrical, privacy or tenancy topic: "## Sources" has ${n} official or manufacturer link(s) (want at least ${SOURCES_MIN_LEGAL}; retailers and this site do not count) (CQ2)`);
    }
  }

  // CQ3: titles that promise what the body does not deliver.
  const titles = `${post.title || ''} ${post.seoTitle || ''}`;
  if (TITLE_FIGURES.test(titles)) {
    const figures = new Set(body.replace(/\]\([^)]*\)/g, ']').match(FIGURE) ?? []);
    const refusal = body.match(FIGURE_REFUSAL);
    if (refusal) issues.push(`title promises figures ("${titles.match(TITLE_FIGURES)[0]}") but the body declines to give them: "${excerpt(body, refusal.index, refusal[0].length)}" - retitle, or add dated, sourced figures (CQ3)`);
    else if (figures.size < TITLE_FIGURES_MIN) issues.push(`title promises figures ("${titles.match(TITLE_FIGURES)[0]}") but the body gives ${figures.size} (want at least ${TITLE_FIGURES_MIN} dated, sourced figures, or retitle) (CQ3)`);
  }
  const year = titles.match(/\b20\d\d\b/);
  const programmeWord = titles.match(TITLE_PROGRAMME);
  if (year && programmeWord) {
    const titleLower = titles.toLowerCase();
    const named = [...prose(body).matchAll(PROGRAMME_NAME)]
      .map((m) => m[0].replace(/^(?:The|A|An|This|That|Our|Your|Each|Every|Any)\s+/, '').trim())
      .filter((name) => name.split(/\s+/).length >= 2 && !titleLower.includes(name.toLowerCase()));
    if (!named.length) issues.push(`title pairs ${year[0]} with "${programmeWord[0]}" but the body names no specific programme (e.g. "Cheaper Home Batteries Program"): name it and link its official page, or drop the year (CQ3)`);
    else if (!OFFICIAL_SOURCE.test(body)) issues.push(`names "${named[0]}" but links no official (.gov.au) page for it (CQ3)`);
  }
  for (const line of body.split('\n')) {
    if (PRICE.test(line) && !/\]\(https?:/.test(line) && !/^\s*\|/.test(line)) {
      issues.push(`price without a linked source: "${line.trim().slice(0, 90)}"`);
      break;
    }
  }

  // Style.
  const lower = all.toLowerCase();
  for (const p of HYPE_PHRASES) if (new RegExp(`\\b${p.replace(/[-']/g, (c) => `\\${c}`)}\\b`).test(lower)) issues.push(`filler phrase: "${p}"`);
  const us = prose(all).match(US_SPELLING);
  if (us) issues.push(`US spelling: "${us[0]}"`);
  if (/\\n/.test(body)) issues.push('escaped newlines (\\n) in the text');

  return issues;
}

/** Question-form H2s required for an article with n H2s (Sources/FAQ excluded). */
export function questionH2Required(n) {
  return Math.max(1, Math.min(QUESTION_H2_MIN, Math.ceil(n * QUESTION_H2_SHARE)));
}

/** A Markdown table: a header row followed by a |---| separator row. */
export function hasMarkdownTable(markdown) {
  return /^\s*\|.*\|\s*\n\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/m.test(String(markdown));
}

/** Distinct external source links in the "## Sources" section (CQ2). */
export function sourceLinks(markdown) {
  const text = String(markdown);
  const start = text.search(/^##\s+Sources\s*$/im);
  if (start < 0) return [];
  const rest = text.slice(start).replace(/^##\s+Sources\s*$/im, '');
  const end = rest.search(/^#{1,2}\s/m);
  const section = end >= 0 ? rest.slice(0, end) : rest;
  const urls = section.match(/https?:\/\/[^\s)\]"'>`]+/g) ?? [];
  return [...new Set(urls.filter((u) => !NOT_A_SOURCE.test(u)).map(normaliseUrl))];
}

/*
 * Link integrity, checked before an article is saved (audit H2/C3, Oct 2026).
 * door-window-sensors-entry-alerts was stored with <a href=\"https://
 * nxtsmarthome.com.au/security/...\">: JSON-escaped quotes, so browsers read the
 * href as a relative \"https:/... path, and the retired /security/ prefix.
 * Five links crawled as 404s.
 *
 * repairBodyLinks() fixes what has exactly one right answer: \" becomes ",
 * "https:/x" becomes "https://x", and /security/, /energy/, /climate/,
 * /entertainment/ and /product/ links to a single article or product move to
 * their canonical URL (next.config.mjs redirects /product/:slug to
 * /products/:slug/). bodyLinkProblems() then lists anything still malformed;
 * the writer refuses to save an article with any.
 */
const LEGACY_PATH = { ...Object.fromEntries(Object.entries(CATEGORY_URL_SLUG).filter(([k, v]) => k !== v)), product: 'products' };
const LEGACY_KEYS = Object.keys(LEGACY_PATH).join('|');
const LEGACY_ABSOLUTE = new RegExp(`https?://(?:www\\.)?nxtsmarthome\\.com\\.au/(${LEGACY_KEYS})/([a-z0-9-]+)/?(#[\\w-]*)?(?![\\w/.-])`, 'gi');
const LEGACY_RELATIVE = new RegExp(`(\\]\\(|href=["'])/(${LEGACY_KEYS})/([a-z0-9-]+)/?(#[\\w-]*)?(?=[)"'\\s])`, 'gi');
const LEGACY_ANY = new RegExp(`(?:\\]\\(|href=["']|https?://(?:www\\.)?nxtsmarthome\\.com\\.au)/(?:${LEGACY_KEYS})(?=[/)"'#?\\s]|$)`, 'i');
const SINGLE_SLASH_SCHEME = /\bhttps?:\/(?!\/)/gi;

function legacyTarget(prefix, slug, hash = '') {
  return `${SITE_ORIGIN}/${LEGACY_PATH[prefix.toLowerCase()]}/${slug.toLowerCase()}/${hash}`;
}

export function repairBodyLinks(markdown) {
  const repaired = [];
  let text = String(markdown ?? '');
  const escaped = (text.match(/\\"/g) ?? []).length;
  if (escaped) {
    text = text.replace(/\\"/g, '"');
    repaired.push(`${escaped} escaped quote(s) \\"`);
  }
  text = text.replace(SINGLE_SLASH_SCHEME, (m) => {
    repaired.push(`${m} -> ${m}/`);
    return `${m}/`;
  });
  text = text.replace(LEGACY_ABSOLUTE, (m, prefix, slug, hash) => {
    const to = legacyTarget(prefix, slug, hash);
    repaired.push(`${m} -> ${to}`);
    return to;
  });
  text = text.replace(LEGACY_RELATIVE, (m, lead, prefix, slug, hash) => {
    const to = legacyTarget(prefix, slug, hash);
    repaired.push(`${m.slice(lead.length)} -> ${to}`);
    return `${lead}${to}`;
  });
  return { text, repaired };
}

/** Malformed links left in a body; empty means it may be saved. */
export function bodyLinkProblems(markdown) {
  const text = String(markdown ?? '');
  const problems = [];
  const at = (i) => text.slice(Math.max(0, i - 20), i + 70).replace(/\s+/g, ' ').trim();
  let m;
  if ((m = /\\"/.exec(text))) problems.push(`escaped quote (\\") in the body: "${at(m.index)}"`);
  if ((m = /\bhttps?:\/(?!\/)/i.exec(text))) problems.push(`URL with one slash after the scheme: "${at(m.index)}"`);
  if ((m = LEGACY_ANY.exec(text))) problems.push(`link to a retired path (/${LEGACY_KEYS.split('|').join('/, /')}/) with no certain canonical URL: "${at(m.index)}" - link the current /<category-slug>/<article>/ or /products/<slug>/ URL`);
  return problems;
}

/**
 * Near-duplicate test for a topic against existing titles (C3). Words are
 * weighted by rarity across all titles, so "smart home australia" counts for
 * little and "ducted zoning" for a lot.
 */
export function nearDuplicateOf(topic, titles) {
  const df = new Map();
  for (const t of titles) for (const w of titleWords(t)) df.set(w, (df.get(w) ?? 0) + 1);
  const n = Math.max(titles.length, 1);
  const weight = (w) => Math.log((n + 1) / ((df.get(w) ?? 0) + 1)) + 1;
  const x = titleWords(topic);
  if (x.size < 2) return null;
  for (const t of titles) {
    const y = titleWords(t);
    if (y.size < 2) continue;
    let shared = 0;
    let total = 0;
    for (const w of new Set([...x, ...y])) {
      total += weight(w);
      if (x.has(w) && y.has(w)) shared += weight(w);
    }
    // 0.38, tuned on the live titles (Oct 2026): catches the audit's camera-storage and
    // neutral-switch pairs (0.41), leaves robot-vacuum guide vs stick vacuum (0.37) apart.
    if (shared / total >= 0.38) return t;
  }
  return null;
}

const STOP = new Set(('a an and are as at be best by can do does for from guide how i in into is it its of on or should '
  + 'the to vs what when where which who why will with without you your aussie australia australian australians au '
  + 'home homes smart need needs that this').split(' '));

function titleWords(s) {
  const w = String(s).toLowerCase().replace(/\b20\d\d\b/g, '').match(/[a-z0-9]+/g) ?? [];
  return new Set(w.filter((x) => x.length > 1 && !STOP.has(x)).map((x) => (x.length > 3 && x.endsWith('s') && !x.endsWith('ss') ? x.slice(0, -1) : x)));
}

/*
 * Research with OpenRouter web search (the writer's default provider since
 * Oct 2026; the Gemini account has no credit). The `web` plugin runs a search,
 * puts the results in front of the model, and returns them as
 * message.annotations of type url_citation ({ url, title, content,
 * start_index, end_index }). Same result shape as researchWithGemini():
 * { json: { facts, officialSources }, searchedUrls }.
 *
 * Pricing (openrouter.ai/docs/features/web-search, checked 17 Oct 2026): the
 * Exa engine costs $0.007 per request (instant/fast/auto) and includes up to
 * 10 results, $0.001 per extra result; Parallel $0.001 (turbo/fast) or $0.005
 * (basic/advanced) per request; Perplexity $0.005 per request; "native" search
 * (OpenAI, Anthropic, Perplexity, xAI models) is passed through at the
 * provider's own price. All plus normal LLM token costs. Exa is the default
 * here for a predictable cost; OPENROUTER_SEARCH_ENGINE overrides it.
 */
export async function researchWithOpenRouter({ apiKey, model, prompt, maxResults = 8, engine = 'exa', log = console.log }) {
  const plugin = { id: 'web', max_results: maxResults };
  if (engine && engine !== 'auto') plugin.engine = engine;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': SITE_ORIGIN,
      'X-Title': 'NXT Smart Home writer',
    },
    body: JSON.stringify({
      model,
      plugins: [plugin],
      usage: { include: true },
      max_tokens: 4000,
      messages: [
        { role: 'system', content: 'You research facts for an Australian smart-home site. Use the web search results. Report only what the pages actually state, each with the URL of the page it came from. Return strict JSON only.' },
        {
          role: 'user',
          content: `${prompt}\n\nReturn STRICT JSON only, no prose:\n{ "facts": [{ "fact": string, "url": string }], "officialSources": [{ "name": string, "url": string }] }\n- facts: 8-20 short, specific statements, each with the exact URL of the search result it came from.\n- officialSources: the manufacturer, regulator and official pages among the search results, with their exact URLs.\n- Use only URLs from the search results, character for character.`,
        },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  const msg = JSON.parse(text);
  const message = msg.choices?.[0]?.message ?? {};
  const usage = msg.usage ?? {};
  const cited = [];
  for (const a of message.annotations ?? []) {
    const url = a?.url_citation?.url ?? a?.url;
    if (a?.type === 'url_citation' && url && /^https?:\/\//i.test(url) && !cited.includes(url)) cited.push(url);
  }
  const { parseAiJson } = await import('./parse-ai-json.mjs');
  let parsed = {};
  try {
    parsed = parseAiJson(String(message.content ?? ''), { providerName: 'OpenRouter research' }) ?? {};
  } catch (err) {
    log(`  research : could not parse OpenRouter JSON (${String(err.message).slice(0, 120)})`);
  }
  // A URL the model wrote is kept only if it is one the search returned, or on
  // a host the search returned (a sibling page there); anything else may be
  // invented, so its fact loses the link and it is not a source.
  const searchedUrls = new Set(cited.map(normaliseUrl));
  const hosts = new Set(cited.map(hostOf).filter(Boolean));
  const trusted = (url) => typeof url === 'string' && /^https?:\/\//i.test(url) && (searchedUrls.has(normaliseUrl(url)) || hosts.has(hostOf(url)));
  const facts = (Array.isArray(parsed.facts) ? parsed.facts : [])
    .filter((f) => f && typeof f.fact === 'string' && f.fact.trim())
    .map((f) => ({ fact: f.fact.trim(), url: trusted(f.url) ? f.url : '' }));
  const officialSources = (Array.isArray(parsed.officialSources) ? parsed.officialSources : [])
    .filter((s) => s && trusted(s.url))
    .map((s) => ({ name: String(s.name || hostOf(s.url)), url: s.url }));
  for (const url of cited) {
    if (!officialSources.some((s) => normaliseUrl(s.url) === normaliseUrl(url))) officialSources.push({ name: hostOf(url), url });
  }
  for (const x of [...facts, ...officialSources]) if (x.url) searchedUrls.add(normaliseUrl(x.url));
  return { json: { facts, officialSources }, searchedUrls, citedUrls: cited, usage, model: msg.model || model };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** One line describing OpenRouter's usage/cost block, or '' when absent. */
export function openRouterUsageLine(usage) {
  if (!usage || typeof usage !== 'object') return '';
  const parts = [];
  if (usage.cost != null) parts.push(`cost US$${Number(usage.cost).toFixed(4)}`);
  if (usage.prompt_tokens != null) parts.push(`${usage.prompt_tokens} in`);
  if (usage.completion_tokens != null) parts.push(`${usage.completion_tokens} out tokens`);
  const web = usage.server_tool_use?.web_search_requests;
  if (web != null) parts.push(`${web} web search request(s)`);
  if (usage.cost_details?.upstream_inference_cost != null) parts.push(`upstream US$${Number(usage.cost_details.upstream_inference_cost).toFixed(4)}`);
  return parts.join(', ');
}

/*
 * Product boxes only for products the article names (CLAUDE.md rule 8, audit
 * Oct 2026: SmartThings Station, Homey Pro, Aqara M100 and Hue Bridge boxed in
 * kitchen, bedroom, nursery and garage articles that never discussed them).
 * A product counts as mentioned when the text outside markers and link targets
 * names it: its name ("Hub M100", "SmartThings Station"), brand + name
 * ("Homey Pro", "Philips Hue Bridge"), or brand/series + a model number
 * ("Aqara ... M100", "Tapo P110"). Catalogue names are scraped retail strings,
 * so the name is cut at the first descriptor ("Tapo C220 2K Pan/Tilt Security
 * Camera" -> "Tapo C220").
 */
const NAME_GENERIC = new Set(('smart home wi fi wifi plug plugs socket camera cam cameras security speaker display doorbell video bulb bulbs '
  + 'light lights lamp strip lightstrip sensor sensors switch switches controller control monitor monitoring power portable '
  + 'outdoor indoor pan tilt kit pack set new gen generation wireless matter thread zigbee z wave bluetooth energy multi protocol '
  + 'gateway hub bridge module automation the a an hd 4k 2k app compatible system box').split(' '));
const NAME_CONNECTOR = new Set('with for and or by in to of'.split(' '));
const NOT_MODEL = /^(?:\d+(?:st|nd|rd|th|k|mp|w|wh|kwh|mah|v|a|mm|cm|m|p|hz|ghz|mhz|in|pcs|pk|pack|x|l|gb|tb)|(?:e|es|b|gu|mr)\d{2}|v\d+|gen\d+|ip\d{2}|wifi\d|usb\d?c?|20\d\d)$/;
const nameTokens = (s) => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').match(/[a-z0-9]+/g) ?? [];
const isModelToken = (t) => /[a-z]/.test(t) && /\d/.test(t) && !NOT_MODEL.test(t);
const phraseRe = (tokens) => tokens.map((t) => t.replace(/[^a-z0-9]/g, '')).join('[^a-z0-9]+');

export function productMentionPatterns(product) {
  const brand = nameTokens(product?.brand);
  const rawName = String(product?.name || '').replace(/\([^)]*\)/g, ' ');
  const cut = rawName.split(/\s[-–—|]\s|,|;/)[0];
  let name = nameTokens(cut);
  // "TP-Link" + "Tapo ..." and names that repeat the brand.
  while (name.length && brand.length && name[0] === brand[0] && name.length > 1) name = name.slice(brand.length > 1 && name[1] === brand[1] ? 2 : 1);
  const head = [];
  for (const t of name) {
    if (NAME_CONNECTOR.has(t) && head.length) break;
    if (head.length && NAME_GENERIC.has(t) && head.some((h) => !NAME_GENERIC.has(h))) break;
    head.push(t);
    if (/\d/.test(t)) break;
  }
  const meaningful = (tokens) => tokens.some((t) => /[a-z]/.test(t) && !NAME_GENERIC.has(t) && !NAME_CONNECTOR.has(t));
  const phrases = [];
  const add = (tokens) => {
    if (tokens.length >= 2 && meaningful(tokens) && !phrases.some((p) => p.join(' ') === tokens.join(' '))) phrases.push(tokens);
  };
  const headOk = head.length && head.some((t) => !['smart', 'home', 'wi', 'fi', 'wifi', 'the', 'matter', 'zigbee', 'thread'].includes(t));
  if (headOk) {
    if (meaningful(head)) add(head);
    if (brand.length) add([...brand, ...head]);
    const last = brand[brand.length - 1];
    if (brand.length > 1 && last && last.length >= 3 && !NAME_GENERIC.has(last) && last !== 'link') add([last, ...head]);
  }
  if (name.length <= 8 && meaningful(name)) add(name);
  const res = phrases.map((p) => new RegExp(`(?<![a-z0-9])${phraseRe(p)}(?![a-z0-9])`, 'i'));
  // brand or series word + up to two words + model number.
  const models = name.filter(isModelToken);
  const prefixes = [...new Set([brand.join(' '), ...brand.filter((b) => b.length >= 3 && !NAME_GENERIC.has(b) && b !== 'link'),
    ...name.filter((t) => !isModelToken(t) && !NAME_GENERIC.has(t) && !NAME_CONNECTOR.has(t) && t.length >= 3 && !/\d/.test(t))])].filter(Boolean);
  for (const m of models) {
    for (const pre of prefixes) {
      res.push(new RegExp(`(?<![a-z0-9])${phraseRe(pre.split(' '))}(?:[^a-z0-9]+[a-z0-9]+){0,2}?[^a-z0-9]+${m}(?![a-z0-9])`, 'i'));
    }
  }
  return res;
}

/** Text with product markers, link targets and bare URLs blanked (same length, so indexes hold). */
export function mentionText(markdown) {
  const blank = (m) => ' '.repeat(m.length);
  return String(markdown || '')
    .replace(/::product:[a-z0-9-]+::/gi, blank)
    .replace(/\]\([^)]*\)/g, (m) => `]${blank(m.slice(1))}`)
    .replace(/https?:\/\/[^\s)\]"'>`]+/g, blank);
}

/** Index of the first mention of the product in the text (markers and URLs ignored), or -1. */
export function productMentionIndex(product, markdown) {
  const text = mentionText(markdown);
  let best = -1;
  for (const re of productMentionPatterns(product)) {
    const m = re.exec(text);
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  return best;
}

export function isProductMentioned(product, markdown) {
  return productMentionIndex(product, markdown) >= 0;
}

/**
 * Removes ::product:<slug>:: markers whose product the text never names.
 * products: catalogue records ({ slug, name, brand }). Unknown slugs are kept
 * as they are (the caller decides about those).
 */
export function filterProductMarkers(markdown, products) {
  const bySlug = new Map((products ?? []).map((p) => [String(p.slug).toLowerCase(), p]));
  const kept = [];
  const dropped = [];
  const text = String(markdown || '');
  const out = text.replace(/[ \t]*::product:([a-z0-9-]+)::[ \t]*/gi, (m, slug) => {
    const p = bySlug.get(slug.toLowerCase());
    if (!p) return m;
    if (isProductMentioned(p, text)) {
      kept.push(p.slug);
      return m;
    }
    dropped.push(p.slug);
    return '';
  });
  return { text: out.replace(/\n{3,}/g, '\n\n'), kept, dropped };
}

/*
 * Image alt text (audit Oct 2026: media alt was the filename with hyphens as
 * spaces). Cover: the article title. Gallery: the section the image
 * illustrates, "<section> — illustration", sentence case, at most ALT_MAX
 * characters. Never says "AI".
 */
export function imageAltText({ kind = 'cover', title = '', seoTitle = '', prompt = '', sections = [], body = '', exclude = [] } = {}) {
  const clean = (s) => String(s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#]/g, '').replace(/\bAI[- ]generated\b|\bAI\b/g, '').replace(/\s+/g, ' ').trim();
  if (kind === 'cover') return clip(clean(title) || clean(seoTitle) || 'Smart home', ALT_MAX);
  const stop = new Set('a an and are as at be by can do does for from how in into is it its of on or the to what when where which why will with you your smart home australian australia'.split(' '));
  const toks = (s) => new Set((String(s).toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !stop.has(w)).map((w) => w.replace(/s$/, '')));
  const want = toks(prompt);
  let best = null;
  let bestScore = 0;
  for (const s of sections) {
    if (exclude.includes(s)) continue;
    const quoted = String(prompt).includes(`"${s}"`) ? 100 : 0;
    let score = quoted;
    for (const w of toks(s)) if (want.has(w)) score += 1;
    if (score > bestScore) { best = s; bestScore = score; }
  }
  let subject = best ? clean(best) : '';
  if (!subject) {
    subject = clean(String(prompt).split(/(?<=[.!?])\s/)[0])
      .replace(/^(?:an?\s+)?(?:editorial\s+)?(?:hero\s+)?(?:photo(?:graph)?|image|shot|picture)s?\s+(?:of|illustrating|showing|for)\s+(?:the concept of\s+)?/i, '')
      .replace(/\b(?:photorealistic|editorial(?: photography)?(?: style)?|shot on a \d+mm lens)\b,?/gi, '')
      .replace(/["“”]/g, '')
      .replace(/[\s,.;:]+$/, '')
      .trim();
  }
  if (!subject) subject = clean(title) || 'Smart home';
  const sentence = sentenceCase(subject.replace(/["“”]/g, ''), body);
  return clip(`${sentence} — illustration`, ALT_MAX, ' — illustration');
}

const ALWAYS_PROPER = new Set('australia australian aussie victoria queensland tasmania sydney melbourne brisbane perth adelaide hobart darwin canberra'.split(' '));
const SMALL_WORDS = new Set('a an and are as at be but by can do does for from how i if in into is it its of on or should the to vs what when where which who why will with you your'.split(' '));

/*
 * Sentence case that keeps names: a Capitalised word stays capitalised only
 * when the body's prose (headings left out) uses it capitalised mid-sentence
 * at least as often as in lower case ("Aqara", "Google Home"); otherwise it
 * is lowered ("Battery Life And Power" -> "Battery life and power").
 */
export function sentenceCase(text, body = '') {
  const prose = String(body || '').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const count = (re) => (prose.match(re) ?? []).length;
  let first = true;
  return String(text).replace(/[A-Za-z][A-Za-z'’]*/g, (w) => {
    if (first) {
      first = false;
      return w[0].toUpperCase() + w.slice(1);
    }
    if (!/^[A-Z][a-z'’]+$/.test(w)) return w; // acronyms, camelCase brands, already lower
    const lower = w.toLowerCase();
    if (SMALL_WORDS.has(lower)) return lower;
    if (ALWAYS_PROPER.has(lower)) return w;
    const esc = w.replace(/[’']/g, "['’]");
    const capsMid = count(new RegExp(`[a-z0-9,;:)]\\s+${esc}(?![A-Za-z])`, 'g'));
    const lowers = count(new RegExp(`(?<![A-Za-z])${esc.toLowerCase()}(?![A-Za-z])`, 'g'));
    return capsMid > 0 && capsMid >= lowers ? w : lower;
  });
}

function clip(text, max, suffix = '') {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const room = max - suffix.length;
  const base = suffix && t.endsWith(suffix) ? t.slice(0, -suffix.length) : t;
  const cut = base.slice(0, room).replace(/\s+\S*$/, '').replace(/[\s,;:.-]+$/, '');
  return `${cut || base.slice(0, room)}${suffix}`;
}

/*
 * Gemini, for running the writer on a Gemini key (owner's request, Oct 2026;
 * an exception to /opt/CLAUDE.md's Anthropic-only rule, kept to this writer).
 */
export async function geminiGenerate({ apiKey, model, body }) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
      continue;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    return json;
  }
  throw new Error('Gemini: gave up after repeated 429/5xx');
}

export function geminiText(json) {
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
}

/*
 * Research with Google Search grounding. A short research-only prompt: given a
 * long brief, Gemini often skips the search and answers from memory (seen on
 * the product notes, 6 Oct 2026). Up to three tries until it actually
 * searched. Returns the same shape as researchJson(): { json: { facts,
 * officialSources }, searchedUrls }, with the grounding sources resolved from
 * Google's redirect links to the real pages.
 */
export async function researchWithGemini({ apiKey, model, prompt }) {
  let notes = '';
  let urls = [];
  for (let attempt = 0; attempt < 3 && !urls.length; attempt++) {
    const json = await geminiGenerate({
      apiKey,
      model,
      body: {
        contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nList each confirmed fact as a bullet point naming the site it came from.` }] }],
        tools: [{ google_search: {} }],
      },
    });
    notes = geminiText(json);
    urls = await groundingUrls(json);
  }
  const facts = notes.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+\.)\s*/, '').trim()).filter((l) => l.length > 15).map((fact) => ({ fact, url: '' }));
  const officialSources = urls.map((url) => ({ name: new URL(url).hostname.replace(/^www\./, ''), url }));
  return { json: { facts, officialSources }, searchedUrls: new Set(urls.map(normaliseUrl)) };
}

async function groundingUrls(json) {
  const out = [];
  for (const c of (json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []).slice(0, 15)) {
    const uri = c.web?.uri;
    if (!uri) continue;
    let real = uri;
    try {
      real = (await fetch(uri, { redirect: 'manual' })).headers.get('location') || uri;
    } catch {}
    if (!/vertexaisearch|grounding-api-redirect/.test(real) && !out.includes(real)) out.push(real);
  }
  return out;
}

/*
 * Catalogue products sold for another market: "Aqara Smart Light Switch H1 EU
 * (No Neutral)" was recommended for Australian walls (audit C6/#26). A product
 * named for the EU, US or UK market is not offered to the writer.
 */
const NON_AU_VARIANT = /\b(?:EU|US|UK)\b(?![- ]?(?:compatible|version available))|\b(?:EU|US|UK)[- ]plug\b|\bEuropean version\b|\bUS version\b/;
// CQ5: the catalogue's "Plug Type" spec, when it names a non-AU plug. Ignored
// when the name or slug says AU (some AU listings carry scraped US specs).
const NON_AU_PLUG = /\b(?:EU|US|UK|European|American|British)\s+plug\b|\bType\s+[ABCEFG]\b/i;
const MARKED_AU = /\b(?:AU|AUS|Australian?)\b|\bAS\/NZS\b/i;
export function isNonAuVariant(product) {
  const label = `${product?.name || ''} ${product?.slug ? product.slug.replace(/-/g, ' ').replace(/\b(eu|us|uk|au)\b/g, (m) => m.toUpperCase()) : ''}`;
  if (NON_AU_VARIANT.test(label)) return true;
  if (MARKED_AU.test(label)) return false;
  const specs = Array.isArray(product?.specifications) ? product.specifications : [];
  return specs.some((s) => /plug/i.test(String(s?.name || '')) && NON_AU_PLUG.test(String(s?.value || '')) && !MARKED_AU.test(String(s?.value || '')));
}

/** A "best X" topic is a roundup, whatever post type it was queued with. */
export function isBestOfTopic(topic) {
  return /^\s*(?:the\s+)?(?:\d+\s+)?best\b/i.test(String(topic));
}

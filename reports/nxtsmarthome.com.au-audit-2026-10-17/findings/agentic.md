# Agent Readiness: nxtsmarthome.com.au (checked 2026-10-17)

## Scores
- Lighthouse Agentic Browsing: unavailable (X/N not obtainable). PSI returned HTTP 429 (daily quota, no API key) for both mobile and desktop. Re-run after /seo google setup. Do not infer a fraction.
- Agent-UX heuristic (separate from Lighthouse, status complete on all 4 pages): home 80, article (/setup-guides/how-to-choose-set-up-smart-plug-australia/) 80, product (/products/millers-falls-portable-power-station-400w/) 100, /contact/ 100. Mean 90/100.
- Counted-audit paths still open: publishing a valid /llms.txt adds a counted pass (currently dropped as not applicable); WebMCP form annotation counts only if every form is annotated; ai-catalog.json is not applicable when absent.

## What works
- Server-rendered: 1218 words without JS, no JS-shell marker.
- robots.txt reachable (200), one `*` group, Allow /, sitemap declared; sensitive paths (/admin/, /api/, /search/, /preview/) disallowed.
- Real 404s for unknown URLs (no soft-404).
- Semantic landmarks present (main#main, labelled navs "Start here" and "Footer", footer); 9-14 landmarks per page; no div-onclick widgets.
- /contact/ form: every field has a label with for=id (name, email, message), radio topic group, submit button named, honeypot field tabindex=-1. 0 unnamed interactive nodes.
- Product page: 0 unnamed interactive nodes.

## Findings
### P1 (fix)
1. Unnamed interactive nodes on home (12) and article (22). Evidence: full-card overlay links `<a class="absolute inset-0" href="...">` with no text, aria-label or title, plus decorative gradient anchors `<a class="absolute inset-x-0 bottom-0 ... from-black">`, duplicating the real title link. Agents using the accessibility tree see nameless links. Fix: add aria-label equal to the card title (or aria-hidden=true and tabindex=-1 on the duplicate overlay anchors; remove the gradient anchor and use a div).
   Note: homepage-render.json has accessibility_tree null, so home counts come from agent_ux_check.py plus a raw-HTML scan.

### P2
2. Contact form not marked for agents beyond labels: submit button has no explicit name beyond its text (fine), but `inputs_without_aria` flagged 7 on /contact/ (radios rely on wrapping label; acceptable). Optional: wrap radios in fieldset/legend "Topic" so the group has a name. Not a defect for users.

### P3 / opportunities (not defects, no ranking or traffic promise)
3. No named AI user-agent groups in robots.txt; all agents fall to `*` (allowed). Optional if the policy is the same for all.
4. No Content-Signal line (draft, Cloudflare CC0 policy; IETF draft expired 2026-04-04; Google does not act on it; checked 2026-09-23). Optional, e.g. `Content-Signal: search=yes, ai-input=yes, ai-train=no` if you want to state a preference.
5. /llms.txt and /llms-full.txt return 404 (community spec; Google Search ignores it; Lighthouse counts it only if present and valid).
6. No Markdown delivery: Accept: text/markdown returns HTML, /index.md 404, no rel=alternate. Vary header lists RSC headers only plus Accept-Encoding (no Accept). No consumer agent is confirmed to request Markdown.
7. WebMCP: 0 registerTool calls, no navigator.modelContext; 1 form (site search/newsletter) not annotated. W3C Community Group draft, Chrome origin trial M149-M156, no ship milestone (checked 2026-09-23). Optional.
8. /.well-known: api-catalog, oauth-*, agent-card.json, ucp, ai-catalog.json all 404. Not applicable for a content site (ai-catalog.json is an ARD draft, Lighthouse 13.5 treats absence as n/a).

## Access policy (robots.txt)
- Training bots (GPTBot, ClaudeBot, Google-Extended, CCBot etc.): allowed via `*`; no explicit rule.
- Search bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot): allowed via `*`.
- User-triggered agents (ChatGPT-User, Claude-User, Perplexity-User, Google-Agent): not blocked. Claude-User honours robots.txt; Perplexity-User and Google-Agent generally ignore it; ChatGPT-User may not apply.
- UA-matrix testing not run (no authorization).

## Standards status (dates from vendor-matrix.md, checked 2026-09-23)
WebMCP: W3C CG draft, not a standard; WebKit opposes, Mozilla neutral. Content-Signal: preference, not enforcement. ai-catalog.json (ARD 1.0) and Web Bot Auth (draft-ietf-webbotauth-httpsig-protocol-00): drafts. Lighthouse 13.5.0 is current but did not run here.

## Audit-data.json findings (AI Search Readiness)
[
 {"title":"Unnamed interactive links in card overlays (home 12, article 22)","severity":"medium","description":"Empty full-card anchors have no accessible name for accessibility-tree agents.","recommendation":"Add aria-label or hide duplicate overlay anchors with aria-hidden and tabindex=-1."},
 {"title":"Lighthouse Agentic Browsing fraction unavailable","severity":"low","description":"PSI HTTP 429 quota exceeded.","recommendation":"Configure a Google API key and re-run lighthouse_agentic.py."},
 {"title":"No llms.txt, Markdown delivery, Content-Signal or WebMCP","severity":"info","description":"Optional agent-readiness opportunities; drafts or community practice.","recommendation":"Consider llms.txt and a Content-Signal line; no ranking or citation effect promised."}
]

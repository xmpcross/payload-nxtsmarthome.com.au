# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Australians making smart-home decisions for their own home: homeowners and renters in every state and territory. They arrive mid-decision, usually from search, holding a specific question: which device to buy, whether it works with their wiring, plugs, platform or tenancy, how to set it up, or why it keeps dropping off the Wi-Fi.

Groups the content is written for:
- **Beginners** starting a smart home without wasting money.
- **Upgraders** extending an existing setup.
- **Renters** who need removable, no-drill, no-rewire options.
- **Families** choosing cameras, doorbells and locks.
- **Comparers** weighing specific products before buying.
- **Platform users** on Apple Home, Google Home, Alexa, SmartThings or Home Assistant.
- **Troubleshooters** fixing Wi-Fi, compatibility and setup problems.
- **Older or less tech-confident readers**, served by a dedicated guide.

## Product Purpose

An independent Australian smart-home publication: buying guides, comparisons, setup guides, explainers and troubleshooting. Its job is to give each reader a clear, honest, Australia-correct answer to their question.

Success, in priority order:
1. **Trust first.** The reader leaves with an answer they can rely on.
2. **Clicks follow.** Affiliate clicks to Australian retailers happen when a product genuinely fits what the reader needs.

Revenue (affiliate commission, plus advertising) is a consequence of trust, never a reason to bend an answer. Long-term goal: become a trusted Australian smart-home authority.

## Positioning

Smart-home advice written from an Australian starting point, where most online advice assumes an American house. It covers:
- 240V/50Hz and AS/NZS 3000, and what you can legally wire yourself (very little)
- B22 bayonet fittings
- local availability, parallel-import warranty risk and Australian Consumer Law
- time-of-use and feed-in tariffs, rooftop solar and climate
- renter and strata rules

Guides are **research-based, permanently**. They draw on manufacturer documentation, published specifications, Australian standards and regulator guidance, and say which source is which. The site will never claim hands-on testing. That honesty, stated plainly on /about and /how-we-test, is a deliberate position.

Competitors: nestpath.com.au, smarthome.com.au, smartspaceinstallations.com/blog, techradar.com/au, choice.com.au.

## Operating Context

- **How readers arrive:** mostly from organic search, increasingly from AI answer engines, landing on a single article rather than the homepage. Many read on mobile.
- **Content types:** every article is labelled with its type (buying guide, comparison, how-to, explainer, roundup, pillar). Articles open with a short answer where possible, carry a table of contents and an FAQ, and embed real catalogue products inline.
- **Buying path:** buy buttons read "Check price at <retailer>". Prices are deliberately not shown in product boxes because they change daily. Retailers: Amazon AU, eBay AU, JB Hi-Fi, The Good Guys, Officeworks, Bunnings and Harvey Norman.
- **Content source and hosting:** content comes from the shared Strapi CMS (cms.fxnstudio.com). The site is a Next.js app served from this host.

## Capabilities and Constraints

- Article categories (CMS keys): security, lighting, energy, climate, entertainment, hubs, robot vacuums, setup guides and buying guides. The URL slug differs from the key; see `lib/site.ts`.
- Product catalogue (`public/data/products.json`, `content/products/`), with product pages and inline `ProductBox` placements via `::product:<slug>::` markers. Products without a verdict (`bestFor` or `pros`) are not linked or indexed.
- Retailer customer reviews may appear on product pages only when clearly labelled as retailers' customers' reviews, never NXT's, and only from 20 reviews up.
- The editorial guard (`lib/editorial-guard.mjs`) refuses to render any post containing `[VERIFY]`, TODO, TBD or placeholder text.
- Operator: FXN Holdings (confirmed by the owner, 17 Oct 2026).

## Brand Commitments

- **Name and assets:** NXT Smart Home. Logo assets are `/logo.svg` and `/icon-512.png`. The editor is Kritin Curtis.
- **Voice:** honest, practical, plain-spoken and hands-on in tone without claiming hands-on testing. Says when a product is a bad buy.
- **Never shown:** no star ratings, scores, "tested" badges or anything implying testing, anywhere. No ranking promises. No keyword stuffing.
- **Language:** Australian English throughout ("colour", "optimise", "centre"), with AUD, AU retailers, AU standards and voltage.
- **Legal and safety claims** (electrical work, privacy and surveillance, tenancy) are never stated as settled law. They point readers to the official regulator or source.
- **Disclosure:** affiliate relationships and AI-assisted drafting are disclosed openly.

## Evidence on Hand

Real assets:
- 83+ published articles in Strapi.
- A product catalogue with verified retailer links.
- Trust pages: /about, /how-we-test, /affiliate-disclosure.
- An editor profile at /authors/kritin-curtis/.
- The SEO audit of 6 Oct 2026: `reports/nxtsmarthome.com.au-audit/`.

Absent, and must not be fabricated:
- hands-on test results, measurements or lab data
- star ratings or scores of NXT's own
- reader testimonials or reviews of the site
- press mentions
- traffic or audience statistics
- search volumes

## Product Principles

1. **Answer first, honestly.** Give the reader the answer before anything else, and never dress research up as testing.
2. **Australia is the default, not a footnote.** Wiring, fittings, law, retailers, climate and tenancy are designed in from the start.
3. **Commerce serves the answer.** A product appears only where the content genuinely discusses it and it fits the reader's need; buy buttons support the decision and never interrupt it.
4. **Say where facts come from.** Cite official sources for legal, safety and technical claims, and send readers to them rather than asserting the law.
5. **Plain language for every reader.** Beginners and less tech-confident readers must be able to follow without jargon.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA** across the site, covering contrast, keyboard access, screen-reader structure, readable sizes and reduced motion. It matters in particular because the readership includes older and less tech-confident Australians.

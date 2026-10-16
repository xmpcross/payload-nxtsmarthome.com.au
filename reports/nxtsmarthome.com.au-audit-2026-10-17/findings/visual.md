# Visual / Mobile / Above-the-fold: nxtsmarthome.com.au

Score: 68/100

Method: Playwright Chromium, desktop 1366x900, mobile 390x844 (DPR2, touch). All screenshots are in /kspellman/sites/nxtsmarthome.com.au/nxtsmarthome.com.au-audit/screenshots/ as `{home,articles,category-lighting,buying-guide,product,about}-{desktop,mobile}-{fold,full}.png`. All pages returned 200. Body font is 16px everywhere.

## What works
- H1 and value prop are visible on mobile home (`home-mobile-fold.png`): "Smart Home Guides for Australian Homes", then a clear independent/Australia-specific paragraph and "Start here" chips.
- No affiliate or ad units above the fold on any page except the product page, which is expected. Layout is clean.
- Article pages show author (Kritin Curtis + photo), Published and Updated dates above the fold (`buying-guide-mobile-fold.png`).
- Product sidebar (`product-desktop-fold.png`) has a clear yellow "Buy at Amazon AU" button, a price, a "last price update" date, and an affiliate disclosure next to the CTA. Links are rel="sponsored nofollow".
- Responsive nav (hamburger, theme toggle, search); no horizontal overflow on 5 of 6 mobile pages; 1366px content width respected.

## Findings

### HIGH
1. Cookie banner covers about 39% of the mobile viewport (327px of 844) on every page, and it appears on first paint (`*-mobile-fold.png`). It hides the content under the H1 (home cards, the guide hero image, the product image and description). It is a fixed bottom card with stacked Decline/Accept buttons. On desktop it is 161px tall, which is less severe but still covers about 18% of the fold (`home-desktop-fold.png`).
   Fix: use a compact one-line bar on mobile (about 80-100px, buttons side by side), or a non-blocking inline footer notice. Do not show the banner at all if GA is the only consent-gated item and a region-based rule applies. Delay it until after first interaction. Make the copy shorter. "Geniuslink may also affiliate supported retailer links" is confusing wording; rewrite it.
2. Horizontal overflow on the mobile buying guide (`buying-guide-mobile-fold.png`, `buying-guide-mobile-full.png`). scrollWidth is 465px against a 390px viewport. The culprit is `div.single-meta` (the author, date and share row) at right edge 465px, plus the carousel `.embla__slide`. The overflow widens the layout viewport, so the fixed cookie banner and page content get cut off on the right (the "Updated 24 September 2026" text and cookie copy are clipped). The same template is probably used by all guides.
   Fix: add `min-w-0` and `flex-wrap` to `.single-meta` and its children. Add `overflow-x: clip` on the carousel container. Wrap "Published / Updated" onto two lines under 400px.

### MEDIUM
3. Mobile product page (`product-mobile-fold.png`, `product-mobile-full.png`): the H1 "Hub M100" is at y=627px, below a large product image (about 700px of image), and is only 19.2px. The price and "Buy at Amazon AU" button are far down the page (about y=5,200 in the measured layout, close to the page bottom). On mobile, price, retailer links and CTA are not visible without long scrolling. Desktop is good.
   Fix: put the brand, H1, price and a CTA first on mobile (cap the image at about 280px height), add a sticky bottom "Buy at Amazon AU - $37.00" bar (after the cookie banner is fixed), and raise the H1 to 28px or more.
4. Tap targets are too small. The retailer "View" buttons are 28px tall (`product-desktop-fold.png`). Across pages about 3-10 visible links and buttons per mobile fold are under 44px (the "Start here" chips are about 40px tall, breadcrumbs, text links).
   Fix: min-height 44px on the View buttons, chips and breadcrumb links, or add padding.
5. Product price table shows identical $37.00 for Amazon, Officeworks and Bunnings. That looks like placeholder or duplicated data and weakens trust. Verify the feed.
6. Product page has no author or review attribution and no date above the fold. It does say "research-based ... has not tested this product", which is honest, but the product page has little E-E-A-T above the fold. Guides and category pages also lack bylines at first view (category desktop, guide desktop).
7. Product image is a low-resolution white-background cut-out on a dark theme (visible white box, `product-mobile-fold.png`). Use a transparent PNG or place it on a light card.

### LOW
8. AI-generated hero images contain garbled text (home cards, `home-desktop-fold.png`; guide hero in `buying-guide-mobile-fold.png` shows "hat atuaturres / tually mattter"). This looks low quality and is a credibility risk. Regenerate without text, or use real photos.
9. Truncated card titles ("Video Doorbell Buying Guide: What Matters in an...") on the home hero cards (`home-desktop-fold.png`). Allow 3 lines.
10. Affiliate disclosure on the home page was not seen above the fold on any template apart from the product sidebar. Add a short "We may earn a commission" line near the byline on guides (a legal requirement for Australian affiliate content, and a trust signal).
11. Home mobile: no primary CTA button; only chips and a text link ("How we research"). Add a visible button such as "Start with the beginner guide".
12. The product page loads two off-canvas panels (`fixed inset-0` overlays) at full viewport size in the DOM. They are probably hidden, but check that they are not capturing focus or tap events.

## Mobile summary
- Navigation: accessible (hamburger).
- Horizontal scroll: present on the buying guide only (465 vs 390).
- Font: 16px body, 24-36px H1; good readability.
- Interstitials: the cookie card covers 39% of the screen and is the main drag on above-the-fold quality.

## Priority fixes
1. Compact the cookie banner on mobile.
2. Fix `.single-meta` overflow on guides.
3. Reorder the mobile product page (H1, price, CTA first) and add a sticky buy bar.
4. Enlarge small tap targets.
5. Remove the garbled-text hero images.

// Amazon AU product import (DataForSEO Merchant API → Payload), user request 17 Oct 2026.
//
// Finds popular and new smart-home products on amazon.com.au per product
// category, fetches full product data (title, brand, description incl.
// "About this item", product information/specs, images, rating, ASINs,
// availability, price) and creates them in Payload as INACTIVE products, each
// with an Amazon AU offer. Nothing appears on the site until a product is
// enabled in the admin.
//
//   bash /kspellman/sites/nxtsmarthome.com.au/scripts/amazon-import.sh            # estimate only, no API calls
//   bash .../amazon-import.sh --fetch                                               # fetch (paid), save raw data, no DB writes
//   bash .../amazon-import.sh --fetch --write                                       # fetch, then create products
//   bash .../amazon-import.sh --from <run-dir> --write                              # create from a saved run, no API cost
//
// Options: --per-category 20  --candidates 25  --max-cost 2.00  --category <slug>  --priority (high queue, 2x cost)
//
// Raw API responses are saved under app/scratch/amazon-import/<timestamp>/ before
// anything is written, so a failed write never has to be paid for twice.

import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../../payload.config';

type Json = Record<string, any>;

const API = 'https://api.dataforseo.com/v3/';
const LOCATION = 2036; // Australia
const LANGUAGE = 'en_AU';
const DOMAIN = 'amazon.com.au';
const PRICE = { serp: 0.0015, asin: 0.0015 }; // standard queue, USD (dataforseo.com/pricing, 17 Oct 2026)
const AMAZON_MERCHANT = 'Amazon AU';

/** Search phrases per product category (category slug → key/name come from existing products). */
const QUERIES: Record<string, string[]> = {
  'entertainment-and-audio': ['smart speaker', 'streaming media player 4k', 'smart display'],
  lighting: ['smart light bulb', 'smart led strip light', 'smart light switch'],
  'security-and-cameras': ['wifi security camera', 'video doorbell', 'outdoor security camera wireless'],
  'energy-and-solar': ['smart plug energy monitoring', 'portable power station', 'smart power board'],
  'climate-and-comfort': ['smart thermostat', 'smart air purifier', 'smart fan wifi'],
  'robot-vacuums': ['robot vacuum', 'robot vacuum and mop', 'self emptying robot vacuum'],
  'hubs-and-platforms': ['smart home hub', 'zigbee hub', 'matter thread hub'],
  'smart-door-locks': ['smart lock', 'smart deadbolt', 'keyless entry door lock'],
};
const SORTS = ['featured', 'newest_arrival'] as const;

/** Accessories and parts, not smart-home products. */
const EXCLUDE =
  /\b(replacement|accessor(y|ies)|spare|filters?\b|brush(es)?\b|mop pads?|dust bags?|side brush|case\b|cover\b|skin\b|mount\b|bracket|holder|stand\b|cable\b|adapter only|screen protector|sticker|decal|remote cover|battery pack for|compatible with|for (ring|eufy|arlo|google|nest|roborock|ecovacs|dreame|irobot|roomba)\b)/i;

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, d?: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const PER_CATEGORY = Number(opt('per-category', '20'));
const CANDIDATES = Number(opt('candidates', '25'));
const MAX_COST = Number(opt('max-cost', '2'));
const ONLY = opt('category');
const PRIORITY = flag('priority') ? 2 : 1;
const FROM = opt('from');
const FETCH = flag('fetch') || false;
const WRITE = flag('write');
const categories = Object.keys(QUERIES).filter((c) => !ONLY || c === ONLY);
if (ONLY && !categories.length) fail(`Unknown category "${ONLY}". Use one of: ${Object.keys(QUERIES).join(', ')}`);

function fail(msg: string): never {
  console.error('✖', msg);
  process.exit(1);
}

// ---------------------------------------------------------------- estimate
const mult = PRIORITY === 2 ? 2 : 1;
const serps = categories.length * QUERIES[categories[0]].length * SORTS.length;
const asins = categories.length * CANDIDATES;
const estimate = (serps * PRICE.serp + asins * PRICE.asin) * mult;
console.log(`Amazon AU import · ${categories.length} categories · ${PER_CATEGORY}/category (${CANDIDATES} candidates) · ${PRIORITY === 2 ? 'priority' : 'standard'} queue`);
console.log(`Estimated cost: ${serps} searches + ${asins} product pages = US$${estimate.toFixed(3)} (cap US$${MAX_COST.toFixed(2)})`);
if (!FETCH && !FROM) {
  console.log('Estimate only. Add --fetch to call DataForSEO (and --write to create products).');
  process.exit(0);
}
if (FETCH && estimate > MAX_COST) fail(`Estimate exceeds --max-cost ${MAX_COST}.`);

// ---------------------------------------------------------------- DataForSEO client
const { DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD } = process.env;
let spent = 0;
async function dfs(pathname: string, body?: unknown): Promise<Json> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) fail('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set in app/.env.local.');
  const auth = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(API + pathname, {
        method: body ? 'POST' : 'GET',
        headers: { authorization: auth, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as Json;
      if (json.status_code !== 20000) throw new Error(`${json.status_code} ${json.status_message}`);
      spent += Number(json.cost || 0);
      return json;
    } catch (err: any) {
      if (attempt >= 4) throw err;
      await sleep(2000 * attempt);
    }
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Post tasks (≤100 per call), then poll task_get until all are done or 75 min pass. */
async function runTasks(kind: 'products' | 'asin', payloads: Json[]): Promise<Map<string, Json>> {
  const ids = new Map<string, string>(); // task id → tag
  for (let i = 0; i < payloads.length; i += 100) {
    const res = await dfs(`merchant/amazon/${kind}/task_post`, payloads.slice(i, i + 100));
    for (const t of res.tasks || []) {
      if (t.status_code !== 20100) console.log(`  task_post ${kind} rejected: ${t.status_code} ${t.status_message} (${t.data?.tag})`);
      else ids.set(t.id, t.data?.tag);
    }
    if (spent > MAX_COST) fail(`Spent US$${spent.toFixed(3)}, over --max-cost.`);
  }
  console.log(`  ${ids.size} ${kind} task(s) queued · spent so far US$${spent.toFixed(3)}`);
  const done = new Map<string, Json>();
  const deadline = Date.now() + 75 * 60_000;
  while (done.size < ids.size && Date.now() < deadline) {
    await sleep(done.size ? 20_000 : 45_000);
    const ready = await dfs(`merchant/amazon/${kind}/tasks_ready`);
    const readyIds = new Set((ready.tasks?.[0]?.result || []).map((r: Json) => r.id));
    for (const [id, tag] of ids) {
      if (done.has(tag) || !readyIds.has(id)) continue;
      const got = await dfs(`merchant/amazon/${kind}/task_get/advanced/${id}`);
      const task = got.tasks?.[0];
      if (task?.status_code === 20000) done.set(tag, task.result?.[0] || {});
      else console.log(`  task_get ${tag}: ${task?.status_code} ${task?.status_message}`);
    }
    process.stdout.write(`  ${kind}: ${done.size}/${ids.size} ready\r`);
  }
  console.log(`  ${kind}: ${done.size}/${ids.size} collected${done.size < ids.size ? ' (timed out waiting for the rest)' : ''}`);
  return done;
}

// ---------------------------------------------------------------- helpers
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function shortName(title: string, brand?: string): string {
  let t = String(title || '').replace(/\s+/g, ' ').trim();
  for (const sep of [' | ', ' - ', ' – ', ', ']) {
    const i = t.indexOf(sep);
    if (i >= 20) t = t.slice(0, i);
  }
  if (t.length > 100) t = t.slice(0, 100).replace(/\s+\S*$/, '');
  // Drop a leading brand ("eufy Security" or just "eufy"): the site shows brand + name.
  if (brand) {
    for (const prefix of [brand, brand.split(/\s+/)[0]]) {
      if (prefix && t.toLowerCase().startsWith(prefix.toLowerCase() + ' ')) { t = t.slice(prefix.length + 1); break; }
    }
  }
  return t.trim();
}
function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-+$/, '');
}
/** "About this item" points, from the description text DataForSEO returns. */
function splitDescription(desc: string): { about: string[]; rest: string } {
  const lines = String(desc || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const about: string[] = [];
  const rest: string[] = [];
  let inAbout = false;
  for (const line of lines) {
    if (/^about this item/i.test(line)) {
      // Amazon puts the first point on the heading's own line ("About this item  First point…").
      inAbout = true;
      const first = line.replace(/^about this item[:\s]*/i, '').trim();
      if (first) about.push(first);
      continue;
    }
    if (/^(product description|from the manufacturer)/i.test(line)) { inAbout = false; continue; }
    if (inAbout || /^[•\-*]\s/.test(line)) about.push(line.replace(/^[•\-*]\s*/, ''));
    else rest.push(line);
  }
  return { about, rest: rest.join('\n\n') };
}
function specRows(info: Json[] | undefined): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const section of info || []) {
    const body = section?.body;
    if (body && typeof body === 'object') {
      for (const [name, value] of Object.entries(body)) {
        if (value == null || /customer reviews|best sellers rank|date first available/i.test(name)) continue;
        rows.push({ name: name.trim(), value: String(value).replace(/\s+/g, ' ').trim() });
      }
    }
  }
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.name.toLowerCase()) ? false : (seen.add(r.name.toLowerCase()), true)));
}
function score(item: Json, sort: string): number {
  const votes = Number(item.rating?.votes_count || 0);
  const rating = Number(item.rating?.value || 0);
  const bought = Number(String(item.bought_past_month || '').replace(/[^0-9]/g, '')) || 0;
  return (item.is_best_seller ? 500 : 0) + (item.is_amazon_choice ? 300 : 0) + Math.min(bought, 5000) / 10 + Math.log10(votes + 1) * 40 + rating * 10 + (sort === 'newest_arrival' ? 60 : 0);
}

// ---------------------------------------------------------------- run
const runDir = FROM
  ? path.resolve(FROM)
  : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../scratch/amazon-import', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(runDir, { recursive: true });
const save = (name: string, data: unknown) => fs.writeFileSync(path.join(runDir, name), JSON.stringify(data, null, 1));
const load = (name: string) => JSON.parse(fs.readFileSync(path.join(runDir, name), 'utf8'));

const payload = await getPayload({ config });
const existing = (await payload.find({ collection: 'products', limit: 5000, depth: 0, overrideAccess: true })).docs as Json[];
const offers = (await payload.find({ collection: 'offers', limit: 10000, depth: 0, overrideAccess: true })).docs as Json[];
const knownAsins = new Set<string>();
for (const o of offers) {
  const m = String(o.url || '').match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  if (m) knownAsins.add(m[1]);
}
for (const p of existing) for (const a of [p.sourceData?.asin, p.sourceData?.parentAsin]) if (a) knownAsins.add(a);
const knownNames = new Set(existing.map((p) => norm(`${p.brand || ''} ${p.name}`)));
const knownSlugs = new Set(existing.map((p) => p.slug));
const catMeta = new Map<string, Json>();
for (const p of existing) if (p.categorySlug && !catMeta.has(p.categorySlug)) catMeta.set(p.categorySlug, { key: p.categoryKey, name: p.categoryName });

let serpResults: Record<string, Json>;
let details: Record<string, Json>;
let picks: Record<string, string[]>;

if (FROM) {
  serpResults = load('serp.json');
  details = load('asin.json');
  picks = load('picks.json');
  console.log(`Loaded saved run ${runDir}`);
} else {
  // 1. Search: categories × queries × sorts
  console.log('1/2 Searching Amazon AU…');
  const tasks: Json[] = [];
  for (const cat of categories)
    for (const keyword of QUERIES[cat])
      for (const sort_by of SORTS)
        tasks.push({ keyword, location_code: LOCATION, language_code: LANGUAGE, se_domain: DOMAIN, depth: 100, sort_by, priority: PRIORITY, tag: `${cat}|${sort_by}|${keyword}` });
  serpResults = Object.fromEntries(await runTasks('products', tasks));
  save('serp.json', serpResults);

  // 2. Pick candidates per category
  picks = {};
  const taken = new Set<string>();
  for (const cat of categories) {
    const pool = new Map<string, { item: Json; s: number }>();
    for (const [tag, result] of Object.entries(serpResults)) {
      const [c, sort] = tag.split('|');
      if (c !== cat) continue;
      for (const item of result.items || []) {
        if (item.type !== 'amazon_serp' || !item.data_asin) continue;
        if (knownAsins.has(item.data_asin) || taken.has(item.data_asin)) continue;
        if (EXCLUDE.test(item.title || '') || !(Number(item.price_from) >= 15)) continue;
        const s = score(item, sort);
        const prev = pool.get(item.data_asin);
        if (!prev || s > prev.s) pool.set(item.data_asin, { item, s });
      }
    }
    const ranked = [...pool.entries()].sort((a, b) => b[1].s - a[1].s).slice(0, CANDIDATES).map(([asin]) => asin);
    ranked.forEach((a) => taken.add(a));
    picks[cat] = ranked;
    console.log(`  ${cat}: ${pool.size} eligible, ${ranked.length} candidates`);
  }
  save('picks.json', picks);

  // 3. Product details
  console.log('2/2 Fetching product pages…');
  const asinTasks = Object.entries(picks).flatMap(([cat, list]) =>
    list.map((asin) => ({ asin, location_code: LOCATION, language_code: LANGUAGE, se_domain: DOMAIN, priority: PRIORITY, tag: `${cat}|${asin}` })),
  );
  details = Object.fromEntries(await runTasks('asin', asinTasks));
  save('asin.json', details);
  console.log(`DataForSEO cost for this run: US$${spent.toFixed(4)}`);
}

// ---------------------------------------------------------------- build products
type Built = { cat: string; asin: string; data: Json; offer: Json; imageUrl?: string };
const built: Built[] = [];
const report: Json[] = [];
for (const cat of categories) {
  const meta = catMeta.get(cat) || { key: cat, name: cat };
  let kept = 0;
  for (const asin of picks[cat] || []) {
    if (kept >= PER_CATEGORY) break;
    const result = details[`${cat}|${asin}`];
    const info = (result?.items || []).find((i: Json) => i.type === 'amazon_product_info');
    if (!info?.title) { report.push({ cat, asin, skipped: 'no product data' }); continue; }
    const price = Number(info.price_from);
    if (!(price > 0)) { report.push({ cat, asin, skipped: 'no price' }); continue; }
    if (info.is_available === false) { report.push({ cat, asin, skipped: 'unavailable' }); continue; }
    const brand = String(info.author || '').replace(/^(visit the|brand:)\s*/i, '').replace(/\s+store$/i, '').trim() || undefined;
    const name = shortName(info.title, brand);
    if (knownNames.has(norm(`${brand || ''} ${name}`))) { report.push({ cat, asin, skipped: 'already in catalogue (name)' }); continue; }
    let slug = slugify(`${brand || ''} ${name}`) || asin.toLowerCase();
    while (knownSlugs.has(slug)) slug = `${slug}-${asin.toLowerCase()}`.slice(0, 95);
    knownSlugs.add(slug);
    knownNames.add(norm(`${brand || ''} ${name}`));
    const { about, rest } = splitDescription(info.description);
    const description = [rest, about.length ? `About this item:\n${about.map((a) => `• ${a}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
    const shortDescription = (about.slice(0, 2).join(' ') || rest.split(/(?<=[.!?])\s/).slice(0, 2).join(' ')).slice(0, 300).replace(/\s+\S*$/, '') || undefined;
    const specs = specRows(info.product_information);
    if (brand && !specs.some((s) => /^brand$/i.test(s.name))) specs.unshift({ name: 'Brand', value: brand });
    const now = new Date().toISOString();
    const url = `https://www.amazon.com.au/dp/${asin}`;
    // product_images_list holds the 1500px originals; image_url is a 300px thumbnail.
    const mainImage: string | undefined = info.product_images_list?.[0] || info.image_url || undefined;
    built.push({
      cat,
      asin,
      imageUrl: mainImage,
      data: {
        legacyId: `amazon:${asin}`,
        name,
        slug,
        brand,
        active: false,
        catalogueListing: true,
        categoryKey: meta.key,
        categorySlug: cat,
        categoryName: meta.name,
        image: mainImage,
        priceAud: price,
        currency: 'AUD',
        description,
        shortDescription,
        specifications: specs,
        ratingReal: info.rating?.value != null ? Number(info.rating.value) : undefined,
        reviewCountReal: info.rating?.votes_count != null ? Number(info.rating.votes_count) : undefined,
        sourceData: {
          source: 'dataforseo-amazon-au',
          fetchedAt: now,
          pricesCheckedAt: now,
          asin,
          parentAsin: info.parent_asin || undefined,
          productAsins: info.product_asins || undefined,
          title: info.title,
          url,
          aboutThisItem: about,
          details: info.details || undefined,
          productInformation: info.product_information || undefined,
          categories: info.categories || undefined,
          images: info.product_images_list || undefined,
          videos: info.product_videos_list || undefined,
          isAvailable: info.is_available,
          isAmazonChoice: info.is_amazon_choice,
          priceTo: info.price_to ?? undefined,
          currency: info.currency || 'AUD',
        },
      },
      offer: { label: AMAZON_MERCHANT, url, priceAud: price, primary: true, deepLink: true, active: true, order: 0, sourceData: { checkedAt: now, source: 'dataforseo-amazon-au', asin } },
    });
    report.push({ cat, asin, name: `${brand ? brand + ' ' : ''}${name}`, price, rating: info.rating?.value, votes: info.rating?.votes_count, about: about.length, specs: specs.length });
    kept++;
  }
  console.log(`  ${cat}: ${kept} product(s) ready`);
}
save('report.json', report);
fs.writeFileSync(
  path.join(runDir, 'report.md'),
  ['| Category | ASIN | Product | Price (AUD) | Rating | About bullets | Spec rows |', '|---|---|---|---|---|---|---|',
   ...report.filter((r) => !r.skipped).map((r) => `| ${r.cat} | ${r.asin} | ${String(r.name).replace(/\|/g, '/')} | ${r.price} | ${r.rating ?? ''} (${r.votes ?? 0}) | ${r.about} | ${r.specs} |`),
   '', `Skipped: ${report.filter((r) => r.skipped).length}`].join('\n'),
);
console.log(`Report: ${path.join(runDir, 'report.md')}`);

if (!WRITE) {
  console.log(`${built.length} product(s) prepared. Nothing written (add --write, or re-run with --from ${runDir} --write).`);
  process.exit(0);
}

// ---------------------------------------------------------------- write
const merchant = ((await payload.find({ collection: 'merchants', where: { name: { equals: AMAZON_MERCHANT } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]) as Json | undefined;
if (!merchant) fail(`Merchant "${AMAZON_MERCHANT}" not found.`);
const tmp = fs.mkdtempSync(path.join(runDir, 'img-'));
let created = 0;
for (const b of built) {
  try {
    let imageUpload: number | undefined;
    if (b.imageUrl) {
      try {
        const res = await fetch(b.imageUrl);
        if (res.ok) {
          const ext = (res.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
          const file = path.join(tmp, `${b.data.slug}.${ext}`);
          fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
          const media = await payload.create({ collection: 'media', data: { alt: `${b.data.brand ? b.data.brand + ' ' : ''}${b.data.name}` }, filePath: file, overrideAccess: true, context: { skipRevalidation: true } });
          imageUpload = media.id as number;
        }
      } catch (err: any) {
        console.log(`  image failed for ${b.asin}: ${err.message}`);
      }
    }
    const product = await payload.create({ collection: 'products', data: { ...b.data, ...(imageUpload ? { imageUpload } : {}) } as any, overrideAccess: true, context: { skipRevalidation: true } });
    await payload.create({ collection: 'offers', data: { ...b.offer, product: product.id, merchant: merchant.id } as any, overrideAccess: true, context: { skipRevalidation: true } });
    created++;
  } catch (err: any) {
    console.log(`  FAILED ${b.cat} ${b.asin}: ${err.message}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Created ${created}/${built.length} inactive product(s) with Amazon AU offers. Review and enable them in the admin (Commerce → Products).`);
process.exit(0);

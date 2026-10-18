import { cmsDocuments, closeCMS } from '../lib/cms.ts';
/**
 * Fetch author profiles from Payload into content/authors/.
 *
 * Runs as part of `prebuild`, alongside the nav and the search index, for the
 * same reason those do: `output: 'export'` refuses a fetch that is not
 * statically cacheable, so CMS data has to be pulled before the build rather
 * than inside the React tree.
 *
 * The CMS is the source of truth for a contributor's name, role, avatar and
 * bio. Editing the bio in Content Manager was previously invisible to the site,
 * which read only these markdown files — so a bio written in Strapi never
 * appeared, and the file's placeholder text showed instead.
 *
 * The editorial default (nxt-smart-home-editorial.md) is NOT in the CMS and is
 * deliberately left alone: it is the byline for anything with no named author.
 *
 * Never fails the build. If Strapi is unreachable the existing files are left
 * as they are and the build carries on with them.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'content', 'authors');
const KEEP = new Set(['nxt-smart-home-editorial']);

// CMS slug -> the profile the site publishes it as. Same map as AUTHOR_ALIASES
// in lib/authors.ts, which explains why.
const RENAME = {
  'k-curtis': { slug: 'kritin-curtis', name: 'Kritin Curtis' },
};

// CMS template text left in the role field renders as no role line.
const cleanRole = (role) => {
  const value = String(role ?? '').trim();
  return !value || /what they cover|e\.g\./i.test(value) ? '' : value;
};

function env(name) {
  if (process.env[name]) return process.env[name].trim();
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`));
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return '';
}

const BASE = env('SITE_URL') || 'https://nxtsmarthome.com.au';
const TOKEN = env('STRAPI_TOKEN');

/** YAML-safe single-quoted scalar. */
const q = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;

async function main() {
  const rows = await cmsDocuments('authors');
  await closeCMS();
  fs.mkdirSync(DIR, { recursive: true });

  let written = 0;
  for (const row of rows) {
    const cms = row.attributes ?? row;
    if (!cms.slug || !cms.name) continue;
    if (KEEP.has(cms.slug)) continue;
    const a = RENAME[cms.slug] ? { ...cms, ...RENAME[cms.slug] } : cms;
    // Drop a file an earlier run wrote under the CMS slug.
    if (a.slug !== cms.slug) fs.rmSync(path.join(DIR, `${cms.slug}.md`), { force: true });

    const avatar = a.avatar?.url
      ? a.avatar.url
      : '';

    // Off-site profiles first (they also become sameAs on the author page), then the site links.
    const profiles = Array.isArray(a.sameAs)
      ? a.sameAs
          .filter((l) => l && (l.href || l.url))
          .map((l) => `  - label: ${q(l.label ?? l.name ?? 'Profile')}\n    href: ${q(l.href ?? l.url)}`)
      : [];
    const links = [...profiles, '  - label: How we test\n    href: /how-we-test/', '  - label: About this site\n    href: /about/'];

    // The CMS has no long-profile field, so the body comes from the repo:
    // content/author-notes/<slug>.md, plain prose, shown verbatim on
    // /authors/<slug>/ under the header (lib/authors.ts `note`). The short CMS
    // bio stays the byline under every article. No note file, no body — and
    // nothing else goes here: an HTML comment in this position rendered as
    // visible text on the page.
    const notePath = path.join(ROOT, 'content', 'author-notes', `${a.slug}.md`);
    const note = fs.existsSync(notePath) ? fs.readFileSync(notePath, 'utf8').trim() : '';
    const md =
      '---\n' +
      `name: ${q(a.name)}\n` +
      `slug: ${q(a.slug)}\n` +
      `role: ${q(cleanRole(a.role))}\n` +
      `initials: ''\n` +
      `avatar: ${q(avatar)}\n` +
      `bio: ${q((a.bio ?? '').replace(/\s+/g, ' ').trim())}\n` +
      'links:\n' +
      links.join('\n') +
      '\n---\n' +
      (note ? `\n${note}\n` : '');

    fs.writeFileSync(path.join(DIR, `${a.slug}.md`), md);
    written += 1;
  }

  console.log(`[authors] wrote ${written} profile(s) from Payload.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.log(`[authors] ${err.message} — leaving content/authors/ as it is.`);
});

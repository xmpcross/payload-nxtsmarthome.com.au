// Restore original product photos (saved in public/images/products.bak before the
// background recolour and 500px squaring) as each product's uploaded image.
// The `image` path is left unchanged, so clearing `imageUpload` undoes this.
import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../../payload.config';
const write = process.argv.includes('--write');
const payload = await getPayload({ config });
const B = path.resolve(process.cwd(), 'public/images/products.bak');
const bak = fs.readdirSync(B);
const base = (f: string) => f.replace(/\.(png|webp|jpe?g)$/i, '').replace(/-sq\d+$/, '');
const rank = (f: string) => (/\.webp$/i.test(f) ? 0 : /\.jpe?g$/i.test(f) ? 1 : 2);
const prods = (await payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true })).docs as any[];
let done = 0, skipped = 0, failed = 0;
for (const p of prods) {
  const img = String(p.image || '');
  if (!img.startsWith('/images/products/')) continue;
  if (p.imageUpload) { skipped++; continue; }
  const orig = bak.filter((f) => base(f) === base(img.replace('/images/products/', '')) && !/\.png$/i.test(f)).sort((a, b) => rank(a) - rank(b))[0];
  if (!orig) continue;
  if (!write) { done++; continue; }
  try {
    const media = await payload.create({ collection: 'media', data: { alt: `${p.brand && !String(p.name).startsWith(p.brand) ? p.brand + ' ' : ''}${p.name}` } as any, filePath: path.join(B, orig), overrideAccess: true, context: { skipRevalidation: true } });
    await payload.update({ collection: 'products', id: p.id, data: { imageUpload: media.id, sourceData: { ...(p.sourceData || {}), imageRestore: { at: new Date().toISOString(), from: `public/images/products.bak/${orig}`, previousImage: img, note: 'original photo restored as imageUpload; clear imageUpload to undo' } } } as any, overrideAccess: true, depth: 0, context: { skipRevalidation: true } });
    done++;
    if (done % 25 === 0) console.log(`  ${done} restored`);
  } catch (e: any) { failed++; console.log(`  FAILED ${p.slug}: ${e.message}`); }
}
console.log(`${write ? 'Restored' : 'Would restore'} ${done} product image(s); skipped ${skipped} that already have an uploaded image; failed ${failed}`);
process.exit(0);

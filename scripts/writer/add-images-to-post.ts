// Generate fal.ai images for an existing Payload post and attach them.
// Prompts are derived from the post title + content via the AI — one featured
// cover image and two section-specific gallery images.
//
// Usage:
//   tsx add-images-to-post.ts <post-id>
//   AI_PROVIDER=openrouter tsx add-images-to-post.ts <post-id>

import os from 'node:os';
import path from 'node:path';
import fsP from 'node:fs/promises';
import { getPayload } from 'payload';
import config from '../../payload.config';
import { fal } from '@fal-ai/client';
import * as rules from './content-rules.mjs';

const postId = Number(process.argv[2]);
if (!postId) { console.error('Usage: tsx add-images-to-post.ts <post-id>'); process.exit(1); }

const {
  FAL_KEY,
  AI_PROVIDER = 'gemini',
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-3.8-flash',
  ANTHROPIC_API_KEY,
  CLAUDE_MODEL = 'claude-sonnet-4-5',
  OPENAI_API_KEY,
  OPENAI_MODEL = 'gpt-4.1',
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL = 'anthropic/claude-sonnet-4-5',
} = process.env;

if (!FAL_KEY) { console.error('FAL_KEY is not set in .env.local'); process.exit(1); }
fal.config({ credentials: FAL_KEY });

const NO_TEXT = 'No text, letters, words, numbers, titles, labels, watermarks, signs, screens or logos anywhere in the image.';

// ---------------------------------------------------------------------------
// AI: generate image prompts from post content
// ---------------------------------------------------------------------------

async function generateImagePrompts(title: string, content: string): Promise<{ cover: string; gallery: [string, string] }> {
  const sections = (content.match(/^##\s+(.+)/gm) ?? [])
    .map(h => h.replace(/^##\s+/, '').replace(/\*\*/g, '').trim())
    .filter(h => !/^(sources|references|faq|frequently asked)/i.test(h))
    .slice(0, 6);

  const systemPrompt = 'You write image prompts for editorial photography. Return only valid JSON. Never include text, words or logos in image descriptions.';
  const userPrompt = `Article: "${title}"
Section headings: ${sections.map((s, i) => `${i + 1}. ${s}`).join('; ')}

Write exactly 3 editorial photograph prompts for this article:
1. A featured cover image (16:9 landscape) that represents the whole article topic.
2. A gallery image (4:3) illustrating a SPECIFIC concept from one section heading.
3. A gallery image (4:3) illustrating a DIFFERENT specific concept from another section heading.

Rules for ALL prompts:
- Photorealistic editorial photography. Australian home context where natural.
- ${NO_TEXT}
- No close-up faces. No screens showing text. No product packaging with readable text.
- Each image must be visually distinct from the other two.
- 40-70 words each: specific subject, precise setting, lighting, camera angle and composition.
- Make the subject concrete — name the specific device, action or scenario, not just "smart home".

Return STRICT JSON only:
{
  "cover": "...",
  "gallery": ["...", "..."]
}`;

  let raw = '';
  try {
    if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1200 } }),
      });
      const json: any = await res.json();
      raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } else if (AI_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1200, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
      });
      const msg: any = await res.json();
      raw = msg?.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') ?? '';
    } else if (AI_PROVIDER === 'openrouter' && OPENROUTER_API_KEY) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${OPENROUTER_API_KEY}` },
        body: JSON.stringify({ model: OPENROUTER_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 1200 }),
      });
      const msg: any = await res.json();
      raw = msg?.choices?.[0]?.message?.content ?? '';
    } else if (OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 1200 }),
      });
      const msg: any = await res.json();
      raw = msg?.choices?.[0]?.message?.content ?? '';
    }
  } catch (err: any) {
    console.warn(`  AI prompt generation failed (${err.message}) — using fallbacks`);
  }

  // Parse JSON from AI response
  try {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fence ? fence[1] : raw.trim());
    if (parsed?.cover && Array.isArray(parsed?.gallery) && parsed.gallery.length >= 2) {
      // The model's prompts must also forbid text in the image.
      const noText = (p: unknown) => (/\bno text\b/i.test(String(p)) ? String(p) : `${String(p).trim()} ${NO_TEXT}`);
      return { cover: noText(parsed.cover), gallery: [noText(parsed.gallery[0]), noText(parsed.gallery[1])] };
    }
  } catch {}

  // Fallback: derive prompts from section headings without AI
  console.log('  (using section-derived fallback prompts)');
  const cover = `Editorial hero photograph for an article about "${title}". Modern Australian home with smart devices visible in the environment, clean setting, soft natural daylight through windows, shallow depth of field, photorealistic, shot on a 50mm lens. ${NO_TEXT}`;
  const g1 = sections[0]
    ? `Editorial photograph illustrating "${sections[0]}" in a smart home context. Australian home setting, close-up, soft side lighting, neutral tones, editorial photography. ${NO_TEXT}`
    : `Smart home hub and sensors on a shelf in a modern Australian home. Clean surfaces, soft warm indoor lighting, shallow depth of field. ${NO_TEXT}`;
  const g2 = sections[1]
    ? `Editorial photograph illustrating "${sections[1]}" in a smart home context. Australian living room, natural daylight from a window, wide angle, photorealistic. ${NO_TEXT}`
    : `Australian living room with smart lighting. Warm evening light, minimalist décor, wide angle shot. ${NO_TEXT}`;
  return { cover, gallery: [g1, g2] };
}

// ---------------------------------------------------------------------------
// fal.ai + Payload save
// ---------------------------------------------------------------------------

async function generateImage(prompt: string, size: string): Promise<string> {
  const result: any = await fal.subscribe('fal-ai/flux/schnell', { input: { prompt, image_size: size, num_images: 1, enable_safety_checker: true }, logs: false });
  const url = result?.data?.images?.[0]?.url;
  if (!url) throw new Error('fal.ai returned no image URL');
  return url;
}

async function saveImage(payload: any, imageUrl: string, filename: string, alt: string): Promise<number> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const ab = await res.arrayBuffer();
  const ct = res.headers.get('content-type') || 'image/jpeg';
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  const name = `${filename}.${ext}`.slice(0, 120);
  const tmpFile = path.join(os.tmpdir(), name);
  await fsP.writeFile(tmpFile, Buffer.from(ab));
  try {
    // Generated by fal.ai; the article labels the image from this caption.
    const doc: any = await payload.create({ collection: 'media', data: { alt, caption: 'AI-generated illustration' }, filePath: tmpFile, overwriteExistingFiles: false });
    console.log(`  saved media id=${doc.id}: ${name}`);
    return Number(doc.id);
  } finally {
    await fsP.unlink(tmpFile).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const payload = await getPayload({ config });

const post: any = await payload.findByID({ collection: 'posts', id: postId, depth: 0, overrideAccess: true });
if (!post) { console.error(`Post ${postId} not found`); await payload.destroy(); process.exit(1); }

console.log(`Post: "${post.title}" (id=${postId})`);
console.log(`AI provider: ${AI_PROVIDER}`);

const content = String(post.content || '');
const prompts = await generateImagePrompts(String(post.title || ''), content);

console.log('\nPrompts:');
console.log(`  cover:     ${prompts.cover.slice(0, 100)}...`);
console.log(`  gallery-1: ${prompts.gallery[0].slice(0, 100)}...`);
console.log(`  gallery-2: ${prompts.gallery[1].slice(0, 100)}...`);

console.log('\nGenerating 3 images with fal.ai FLUX Schnell...');
const base = String(post.title || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

const [coverUrl, g1Url, g2Url] = await Promise.all([
  generateImage(prompts.cover, 'landscape_16_9'),
  generateImage(prompts.gallery[0], 'landscape_4_3'),
  generateImage(prompts.gallery[1], 'landscape_4_3'),
]);

// Descriptive alt text: cover = article title; gallery = the section each image illustrates.
const altSections = (content.match(/^##\s+(.+)/gm) ?? [])
  .map(h => h.replace(/^##\s+/, '').replace(/\*\*/g, '').trim())
  .filter(h => !/^(sources|references|faq|frequently asked)/i.test(h));
const altBase = { title: post.title, seoTitle: post.seoTitle, sections: altSections, body: content };
const coverAlt = rules.imageAltText({ ...altBase, kind: 'cover', prompt: prompts.cover });
const g1Alt = rules.imageAltText({ ...altBase, kind: 'gallery', prompt: prompts.gallery[0] });
let g2Alt = rules.imageAltText({ ...altBase, kind: 'gallery', prompt: prompts.gallery[1], exclude: altSections.filter(s => g1Alt.toLowerCase().startsWith(s.toLowerCase().slice(0, 20))) });
if (g2Alt === g1Alt) g2Alt = rules.imageAltText({ ...altBase, kind: 'gallery', prompt: prompts.gallery[1], sections: [] });

const [coverId, g1Id, g2Id] = await Promise.all([
  saveImage(payload, coverUrl, `${base}-cover`, coverAlt),
  saveImage(payload, g1Url,   `${base}-gallery-1`, g1Alt),
  saveImage(payload, g2Url,   `${base}-gallery-2`, g2Alt),
]);

await payload.update({
  collection: 'posts',
  id: postId,
  data: { coverImage: coverId, gallery: [g1Id, g2Id] },
  overrideAccess: true,
});

console.log(`\nUpdated post ${postId}: cover=${coverId}, gallery=[${g1Id},${g2Id}]`);
console.log(`Review: https://nxtsmarthome.com.au/admin/collections/posts/${postId}`);

await payload.destroy();

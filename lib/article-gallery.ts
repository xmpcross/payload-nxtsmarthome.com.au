import { responsiveImg } from './image';

type GalleryImage = { src: string; alt?: string; width?: number; height?: number };

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Places a post's gallery images inside its body HTML (user request, 17 Oct
 * 2026): the writer generates a cover plus two gallery images per article, and
 * the gallery was saved but never shown.
 *
 * The images are spread evenly between the article's sections, each placed
 * just before an H2 (never before the first section, Sources or FAQ headings),
 * because the writer's gallery prompts are drawn from those sections. With too
 * few sections to spread them, they go at the end of the body.
 */
export function withGallery(html: string, images: GalleryImage[] | undefined, title: string): string {
  if (!images?.length) return html;

  const figure = (img: GalleryImage, i: number) => {
    const attrs = responsiveImg(img.src, 736, '(max-width: 768px) 100vw, 736px');
    const alt = escapeAttr(img.alt || `${title}, image ${i + 2}`);
    const size = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : ' width="1200" height="900"';
    return (
      `<figure class="article-gallery-figure"><img src="${escapeAttr(attrs.src)}"` +
      (attrs.srcSet ? ` srcset="${escapeAttr(attrs.srcSet)}" sizes="${escapeAttr(attrs.sizes || '')}"` : '') +
      ` alt="${alt}"${size} loading="lazy" decoding="async"></figure>\n`
    );
  };

  // Candidate insertion points: H2s after the first, excluding Sources / FAQ.
  const slots: number[] = [];
  const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  let index = 0;
  while ((m = re.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (index > 0 && !/^(sources?|faqs?|frequently asked)/i.test(text)) slots.push(m.index);
    index += 1;
  }

  const n = images.length;
  if (slots.length < n) return html + images.map(figure).join('');

  // Evenly spaced: the i-th image goes before slot round((i+1) * len / (n+1)).
  const chosen = images.map((_, i) => slots[Math.min(slots.length - 1, Math.round(((i + 1) * slots.length) / (n + 1)) - 1)]);
  let out = html;
  // Insert from the end so earlier offsets stay valid.
  [...chosen.entries()].sort((a, b) => b[1] - a[1]).forEach(([i, at]) => {
    out = out.slice(0, at) + figure(images[i], i) + out.slice(at);
  });
  return out;
}

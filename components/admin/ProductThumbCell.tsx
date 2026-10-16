import type { DefaultServerCellComponentProps } from 'payload';
import { responsiveImg } from '@/lib/image';

/**
 * Products list view: thumbnail column (user request, 17 Oct 2026).
 *
 * Uses the uploaded image (imageUpload, a Media document) when there is one,
 * otherwise the catalogue image URL, the same order lib/catalogue.ts uses for
 * the site. Served through the image optimiser at thumbnail size.
 */
export async function ProductThumbCell({ rowData, payload }: DefaultServerCellComponentProps) {
  let src: string | undefined;
  const upload = rowData?.imageUpload;
  if (upload && typeof upload === 'object' && upload.filename) {
    src = `/api/media/file/${encodeURIComponent(upload.filename)}`;
  } else if (upload) {
    try {
      const media = await payload.findByID({ collection: 'media', id: upload, depth: 0, overrideAccess: true });
      if (media?.filename) src = `/api/media/file/${encodeURIComponent(String(media.filename))}`;
    } catch {
      /* Missing media: fall back to the image URL below. */
    }
  }
  if (!src && typeof rowData?.image === 'string' && rowData.image) src = rowData.image;

  if (!src) {
    return (
      <span
        aria-label="No image"
        style={{ display: 'inline-block', width: 48, height: 48, borderRadius: 6, background: 'var(--theme-elevation-100)' }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...responsiveImg(src, 48, '48px')}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, background: '#fff' }}
    />
  );
}

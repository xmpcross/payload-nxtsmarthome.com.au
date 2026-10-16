'use client';

import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';

export type FeaturedPost = {
  href: string;
  title: string;
  /** From lib/image responsiveImg: spread onto the <img>. */
  image: { src: string; srcSet?: string; sizes?: string };
  imageAlt: string;
  author: string | null;
  date: string;
};

/**
 * Sidebar "Featured Posts": one image card at a time, title and byline over the
 * cover, auto-advancing every 4.5s. Port of bestlooking.skin's slider on the
 * embla carousel this site already uses. Autoplay pauses on hover and focus,
 * and is off for readers who ask for reduced motion; the dots still work.
 */
export default function FeaturedPostsSlider({ posts }: { posts: FeaturedPost[] }) {
  const items = posts.slice(0, 3);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: items.length > 1 });
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || paused || items.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => emblaApi.scrollNext(), 4500);
    return () => window.clearInterval(timer);
  }, [emblaApi, paused, items.length]);

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  if (!items.length) return null;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex">
          {items.map((post) => (
            <div key={post.href} className="min-w-0 shrink-0 grow-0 basis-full">
              <Link href={post.href} className="group relative block h-[250px] overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  {...post.image}
                  alt={post.imageAlt}
                  width={420}
                  height={250}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-5">
                  <span className="block text-lg leading-snug font-bold text-white">{post.title}</span>
                  <span className="mt-2 block text-xs text-white/80">
                    {post.author ? `${post.author} on ${post.date}` : post.date}
                  </span>
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {items.map((post, index) => (
            <button
              key={post.href}
              type="button"
              aria-label={`Show featured post ${index + 1}`}
              aria-current={index === selected}
              onClick={() => scrollTo(index)}
              className={`size-2.5 rounded-full transition ${
                index === selected ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

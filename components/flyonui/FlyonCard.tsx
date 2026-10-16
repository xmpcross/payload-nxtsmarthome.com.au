'use client';

import React from 'react';
import Link from 'next/link';

export type FlyonCardProps = {
  title: string;
  description: string;
  category?: string;
  href: string;
  imageUrl?: string;
  date?: string;
  authorName?: string;
};

export default function FlyonCard({
  title,
  description,
  category,
  href,
  imageUrl,
  date,
  authorName,
}: FlyonCardProps) {
  return (
    <Link
      href={href}
      className="card card-border group flex flex-col overflow-hidden transition-all duration-300 hover:border-primary-500 bg-base-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl"
    >
      {imageUrl && (
        <figure className="aspect-video w-full overflow-hidden bg-base-200">
          <img
            src={imageUrl}
            alt={title}
            width={640}
            height={360}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </figure>
      )}
      <div className="card-body p-5 flex flex-col flex-1 justify-between">
        <div>
          {category && (
            <span className="badge badge-soft badge-primary text-xs font-semibold uppercase tracking-wider mb-2">
              {category}
            </span>
          )}
          <h3 className="card-title text-lg font-bold text-base-content group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm text-base-content/70">
            {description}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-base-200 pt-3 text-xs text-base-content/60">
          {authorName && <span>{authorName}</span>}
          {date && <span>{date}</span>}
        </div>
      </div>
    </Link>
  );
}

import type { Heading } from '@/lib/content';

/**
 * "Contents" box on the single post page: an unbulleted list of the article's
 * section (h2) headings, each an anchor to its heading.
 *
 * Based on bestlooking.skin's ArticleContents (user request, 24 Sep 2026): a
 * light blue panel (#eef2ff) with 12px corners, a 1.35rem bold title and
 * semibold, underlined links in near-black. Bullets were removed on user
 * request (17 Oct 2026); items sit flush with the title. h3s are left out,
 * as there, so the list stays a short outline. Fewer than three sections is not
 * worth a contents list, so it renders nothing.
 */
export default function TableOfContents({ headings }: { headings: Heading[] }) {
  const items = headings.filter((h) => h.level === 2);
  if (items.length < 3) return null;

  return (
    <nav
      aria-labelledby="article-contents-title"
      className="not-prose mb-8 rounded-[12px] bg-[#eef2ff] px-7 pt-6 pb-[22px] dark:bg-[#1c2540]"
    >
      <p
        id="article-contents-title"
        className="mb-3.5 text-[1.35rem] leading-tight font-bold tracking-[-0.6px] text-[#0e0e0f] dark:text-white"
      >
        Contents
      </p>
      <ul className="space-y-2.5">
        {items.map((heading) => (
          <li key={heading.id} className="text-[16px] leading-[1.5625] text-[#0e0e0f] dark:text-slate-100">
            <a
              href={`#${heading.id}`}
              className="font-semibold text-[#0e0e0f] underline decoration-1 underline-offset-[5px] hover:text-[#626568] dark:text-slate-100 dark:hover:text-slate-300"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

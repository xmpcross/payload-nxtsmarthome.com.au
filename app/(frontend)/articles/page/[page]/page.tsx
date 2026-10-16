import { permanentRedirect } from 'next/navigation';

/**
 * Former pages 2..N of /articles/. The list is now one page with search and
 * filters, so old /articles/page/N/ links go to /articles/.
 */
export default function ArticlesPaged() {
  permanentRedirect('/articles/');
}

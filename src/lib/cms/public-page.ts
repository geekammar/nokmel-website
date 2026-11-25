import { cache } from 'react';
import { DEFAULT_CMS_LOCALE, type CmsPageKey } from '@/content/cms/registry';
import {
  getPublishedPageBundle,
  type PublishedPageBundle,
} from '@/lib/cms/service';

const cachedBundle = cache(
  (pageKey: CmsPageKey): Promise<PublishedPageBundle<CmsPageKey>> =>
    getPublishedPageBundle(pageKey, DEFAULT_CMS_LOCALE),
);

export function getPublicPageBundle<K extends CmsPageKey>(
  pageKey: K,
): Promise<PublishedPageBundle<K>> {
  return cachedBundle(pageKey) as Promise<PublishedPageBundle<K>>;
}

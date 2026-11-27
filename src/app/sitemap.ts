import type { MetadataRoute } from 'next';
import {
  buildSitemapEntries,
  isPublicIndexingEnabled,
} from '@/lib/launch-controls';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries(isPublicIndexingEnabled());
}

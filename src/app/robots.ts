import type { MetadataRoute } from 'next';
import {
  buildRobotsPolicy,
  isPublicIndexingEnabled,
} from '@/lib/launch-controls';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return buildRobotsPolicy(isPublicIndexingEnabled());
}

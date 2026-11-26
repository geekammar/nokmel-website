export const SOCIAL_IMAGE_IDS = [
  'mark-transparent-1024',
  'mark-transparent-512',
  'app-icon-light-512',
  'app-icon-dark-512',
] as const;

export type SocialImageId = (typeof SOCIAL_IMAGE_IDS)[number];

export type SocialImageAsset = {
  id: SocialImageId;
  path: `/brand/${string}`;
  label: string;
  width: number;
  height: number;
  alt: string;
};

export const DEFAULT_SOCIAL_IMAGE_ID: SocialImageId = 'mark-transparent-1024';

export const SOCIAL_IMAGES: readonly SocialImageAsset[] = [
  {
    id: 'mark-transparent-1024',
    path: '/brand/logos/nokmel-mark-transparent-1024.png',
    label: 'شعار نكمّل الشفاف (1024 بكسل)',
    width: 1024,
    height: 785,
    alt: 'شعار نكمّل',
  },
  {
    id: 'mark-transparent-512',
    path: '/brand/logos/nokmel-mark-transparent-512.png',
    label: 'شعار نكمّل الشفاف (512 بكسل)',
    width: 512,
    height: 393,
    alt: 'شعار نكمّل',
  },
  {
    id: 'app-icon-light-512',
    path: '/brand/icons/app-icon-light-512.png',
    label: 'أيقونة نكمّل الفاتحة',
    width: 512,
    height: 512,
    alt: 'أيقونة نكمّل الفاتحة',
  },
  {
    id: 'app-icon-dark-512',
    path: '/brand/icons/app-icon-dark-512.png',
    label: 'أيقونة نكمّل الداكنة',
    width: 512,
    height: 512,
    alt: 'أيقونة نكمّل الداكنة',
  },
];

const SOCIAL_IMAGE_BY_ID = new Map(SOCIAL_IMAGES.map((asset) => [asset.id, asset]));

export function isSocialImageId(value: unknown): value is SocialImageId {
  return typeof value === 'string' && SOCIAL_IMAGE_BY_ID.has(value as SocialImageId);
}

export function getSocialImage(id: string | null | undefined): SocialImageAsset {
  if (isSocialImageId(id)) {
    const asset = SOCIAL_IMAGE_BY_ID.get(id);
    if (asset) return asset;
  }
  return SOCIAL_IMAGE_BY_ID.get(DEFAULT_SOCIAL_IMAGE_ID)!;
}

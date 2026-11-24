import { Wordmark } from './Wordmark';

export type LogoVariant = 'primary' | 'dark-surface' | 'light-surface' | 'navy' | 'white';

const MARK_ASPECT = 1080 / 1408;

const variantSrc: Record<LogoVariant, string> = {
  primary: '/brand/logos/nokmel-mark-primary-color.svg',
  'dark-surface': '/brand/logos/nokmel-mark-dark-surface.svg',
  'light-surface': '/brand/logos/nokmel-mark-light-surface.svg',
  navy: '/brand/logos/nokmel-mark-single-navy.svg',
  white: '/brand/logos/nokmel-mark-single-white.svg',
};

type LogoProps = {
  variant?: LogoVariant;
  size?: number;
  withWordmark?: boolean;
  wordmarkLang?: 'ar' | 'en';
  alt?: string;
};

export function Logo({
  variant = 'primary',
  size = 40,
  withWordmark = false,
  wordmarkLang = 'ar',
  alt,
}: LogoProps) {
  const markAlt = withWordmark ? '' : (alt ?? 'نكمّل — Nokmel');
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5">
      <img
        src={variantSrc[variant]}
        alt={markAlt}
        aria-hidden={withWordmark ? true : undefined}
        width={size}
        height={Math.round(size * MARK_ASPECT)}
        className="block h-auto"
        style={{ width: size, height: Math.round(size * MARK_ASPECT) }}
      />
      {withWordmark ? <Wordmark lang={wordmarkLang} /> : null}
    </span>
  );
}

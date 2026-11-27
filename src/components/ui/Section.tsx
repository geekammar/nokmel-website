import type { HTMLAttributes } from 'react';

type SectionProps = HTMLAttributes<HTMLElement> & {
  tone?: 'default' | 'dark' | 'surface';
  /**
   * Vertical rhythm: `normal` is the default section cadence; `compact`
   * tightens adjacent sections so long pages keep a consistent, less
   * airy rhythm on mobile and desktop.
   */
  spacing?: 'normal' | 'compact';
};

const spacingClasses = {
  normal: 'py-12 sm:py-16 lg:py-20',
  compact: 'py-10 sm:py-12 lg:py-14',
} as const;

const toneClasses = {
  default: 'bg-page',
  dark: 'bg-page',
  surface: 'bg-surface',
} as const;

export function Section({
  tone = 'default',
  spacing = 'normal',
  className = '',
  children,
  ...rest
}: SectionProps) {
  return (
    <section
      data-theme={tone === 'dark' ? 'dark' : undefined}
      className={`${toneClasses[tone]} text-text-primary ${spacingClasses[spacing]} ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

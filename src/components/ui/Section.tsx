import type { HTMLAttributes } from 'react';

type SectionProps = HTMLAttributes<HTMLElement> & {
  tone?: 'default' | 'dark';
};

export function Section({ tone = 'default', className = '', children, ...rest }: SectionProps) {
  return (
    <section
      data-theme={tone === 'dark' ? 'dark' : undefined}
      className={`bg-page py-16 text-text-primary sm:py-20 lg:py-24 ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

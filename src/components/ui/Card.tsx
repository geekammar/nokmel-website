import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-card border border-border-subtle bg-surface p-6 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

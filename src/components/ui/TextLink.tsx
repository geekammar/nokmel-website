import type { AnchorHTMLAttributes } from 'react';

type TextLinkProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export function TextLink({ className = '', children, ...rest }: TextLinkProps) {
  return (
    <a
      className={`font-medium text-action-secondary underline-offset-4 hover:underline ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}

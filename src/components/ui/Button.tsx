import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';
type Size = 'md' | 'lg';

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-action-primary-bg text-action-primary-fg hover:bg-action-primary-bg-hover active:bg-action-primary-bg-active',
  secondary:
    'border border-border-interactive bg-transparent text-text-primary hover:bg-surface',
};

const sizeClasses: Record<Size, string> = {
  md: 'min-h-control px-5 text-base',
  lg: 'min-h-control px-7 text-lg',
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const { variant = 'primary', size = 'md', className = '', children, ...rest } = props;
    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
    if ('href' in rest && rest.href !== undefined) {
      const { href, ...linkRest } = rest as ButtonAsLink;
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={classes} {...linkRest}>
          {children}
        </a>
      );
    }
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={classes}
        {...(rest as ButtonAsButton)}
      >
        {children}
      </button>
    );
  },
);

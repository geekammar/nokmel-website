'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

type MobileMenuProps = {
  items: readonly NavItem[];
  legalItems: readonly NavItem[];
  labels: {
    open: string;
    close: string;
    panel: string;
  };
  ctaLabel: string;
};

/**
 * Compact mobile navigation: icon-only disclosure button (>=44px target),
 * full-width panel anchored under the sticky header, current-page indication,
 * close on selection / route change / Escape / outside click, and focus
 * restoration to the toggle on Escape.
 */
export function MobileMenu({ items, legalItems, labels, ctaLabel }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const linkClass = (href: string) =>
    `flex min-h-control items-center rounded-control px-4 text-base font-medium ${
      pathname === href ? 'bg-page text-action-primary-fg' : 'text-text-primary hover:bg-page'
    }`;

  return (
    <div className="md:hidden" data-testid="mobile-nav">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? labels.close : labels.open}
        data-testid="mobile-nav-toggle"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-control w-11 items-center justify-center rounded-control border border-border-interactive text-text-primary hover:bg-page"
      >
        {open ? (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 14" fill="none">
            <path d="M1 1H17M1 7H17M1 13H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <div
        id="mobile-nav-panel"
        ref={panelRef}
        data-testid="mobile-nav-panel"
        hidden={!open}
        role="group"
        aria-label={labels.panel}
        className="absolute inset-x-0 top-full z-50 mt-2 rounded-card border border-border-subtle bg-surface p-2 shadow-lg"
      >
        <nav aria-label={labels.panel}>
          <ul className="flex list-none flex-col gap-1 p-0">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={linkClass(item.href)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="my-2 border-t border-border-subtle" />
        <Link
          href="/join"
          className="flex min-h-control w-full items-center justify-center rounded-control bg-action-primary-bg px-4 font-semibold text-action-primary-fg"
        >
          {ctaLabel}
        </Link>
        <ul className="mt-2 flex list-none flex-col gap-1 p-0">
          {legalItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-control items-center rounded-control px-4 text-sm text-text-secondary hover:bg-page">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

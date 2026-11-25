'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavUi } from '@/content/ar/admin-content';

export type AdminNavItem = {
  id: string;
  label: string;
  available: boolean;
  href?: string;
};

function isActive(pathname: string, item: AdminNavItem): boolean {
  if (!item.available || !item.href) return false;
  if (item.id === 'overview') return pathname === '/admin' || pathname === '/admin/';
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function sectionLinkClass(active: boolean): string {
  return `flex min-h-control items-center rounded-control px-3 text-sm font-semibold transition-colors ${
    active
      ? 'bg-action-primary-bg text-action-primary-fg'
      : 'text-text-primary hover:bg-background'
  }`;
}

function UnavailableItem({ item }: { item: AdminNavItem }) {
  return (
    <span
      aria-disabled="true"
      className="flex min-h-control cursor-not-allowed flex-col justify-center rounded-control px-3 py-2 text-sm text-text-secondary"
      title="غير متاح — في مرحلة لاحقة"
    >
      <span>{item.label}</span>
      <span className="mt-1 w-fit rounded-control bg-background px-2 py-0.5 text-xs text-text-secondary">
        غير متاح — في مرحلة لاحقة
      </span>
    </span>
  );
}

export function AdminDesktopNav({ items, label }: { items: readonly AdminNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden md:block">
      <ul className="flex list-none flex-col gap-1 p-3">
        {items.map((item) => (
          <li key={item.id}>
            {item.available && item.href ? (
              <Link
                href={item.href}
                aria-current={isActive(pathname, item) ? 'page' : undefined}
                className={`${sectionLinkClass(isActive(pathname, item))} w-full`}
              >
                {item.label}
              </Link>
            ) : (
              <UnavailableItem item={item} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminMobileNav({
  items,
  label,
  panelLabel,
}: {
  items: readonly AdminNavItem[];
  label: string;
  panelLabel: string;
}) {
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

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="admin-nav-panel"
        aria-label={open ? adminNavUi.closeMenu : adminNavUi.openMenu}
        data-testid="admin-nav-toggle"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-control w-11 items-center justify-center rounded-control border border-border-interactive text-text-primary hover:bg-background"
      >
        {open ? (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M4 4L14 14M14 4L4 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg aria-hidden="true" width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path
              d="M1 1H17M1 7H17M1 13H17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
      <div
        id="admin-nav-panel"
        ref={panelRef}
        hidden={!open}
        data-testid="admin-nav-panel"
        className="absolute inset-x-0 top-full z-50 max-h-[75vh] overflow-y-auto rounded-card border border-border-subtle bg-surface p-2 shadow-lg"
      >
        <nav aria-label={panelLabel}>
          <ul className="flex list-none flex-col gap-1 p-0">
            {items.map((item) => (
              <li key={item.id}>
                {item.available && item.href ? (
                  <Link
                    href={item.href}
                    aria-current={isActive(pathname, item) ? 'page' : undefined}
                    className={`${sectionLinkClass(isActive(pathname, item))} w-full`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <UnavailableItem item={item} />
                )}
              </li>
            ))}
          </ul>
        </nav>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

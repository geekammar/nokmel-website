'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

/**
 * Shared link list with current-page indication (aria-current + visual state)
 * for the desktop header navigation. The mobile panel keeps its own variant
 * inside `MobileMenu`.
 */
export function DesktopNavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex list-none items-center gap-6 p-0 text-sm">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={pathname === item.href ? 'page' : undefined}
            className={`whitespace-nowrap font-medium underline-offset-4 hover:text-text-primary hover:underline ${
              pathname === item.href
                ? 'text-text-primary underline'
                : 'text-text-secondary'
            }`}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

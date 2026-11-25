import { adminUi } from '@/content/ar/admin';
import { Logo } from '@/components/brand/Logo';
import { requireOwner } from '@/lib/owner';
import { signOutOwner } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireOwner();
  const sections = adminUi.nav;
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <a
        href="#admin-content"
        className="skip-link rounded-control bg-action-primary-bg px-4 py-2 text-sm font-semibold"
        style={{ color: 'var(--action-primary-fg)' }}
      >
        تخطَّ إلى محتوى الإدارة
      </a>
      <header className="border-b border-border-subtle bg-surface">
        <div
          className="flex min-h-control flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
        >
          <div className="flex items-center gap-3">
            <Logo size={32} alt={adminUi.shell.adminTitle} />
            <span className="text-base font-bold text-text-primary">{adminUi.shell.adminTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-text-secondary sm:inline">
              {adminUi.shell.ownerSession}: نشطة
            </span>
            <form action={signOutOwner}>
              <button
                type="submit"
                className="min-h-control rounded-control border border-border-interactive bg-transparent px-4 text-sm font-semibold text-text-primary hover:bg-background"
              >
                {adminUi.shell.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label={adminUi.shell.navLabel}
          className="border-b border-border-subtle bg-surface md:w-64 md:shrink-0 md:border-b-0 md:border-e"
        >
          <ul className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-2 md:flex-col">
            {sections.map((section) =>
              section.available ? (
                <li key={section.id} className="sm:flex-1 md:flex-none">
                  <a
                    href="/admin"
                    aria-current={section.id === 'overview' ? 'page' : undefined}
                    className="flex min-h-control items-center rounded-control px-3 text-sm font-semibold text-text-primary hover:bg-background md:w-full"
                  >
                    {section.label}
                  </a>
                </li>
              ) : (
                <li
                  key={section.id}
                  className="sm:flex-1 md:flex-none"
                  data-available="false"
                >
                  <span
                    aria-disabled="true"
                    className="flex min-h-control cursor-not-allowed items-center rounded-control px-3 text-sm text-text-secondary md:w-full"
                    title={adminUi.shell.unavailableNote}
                  >
                    {section.label}
                    <span className="ms-2 rounded-control bg-background px-2 py-0.5 text-xs text-text-secondary">
                      {adminUi.shell.unavailableNote}
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </nav>
        <main id="admin-content" className="flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

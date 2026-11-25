import { adminUi } from '@/content/ar/admin';
import { adminNavUi } from '@/content/ar/admin-content';
import { Logo } from '@/components/brand/Logo';
import { AdminDesktopNav, AdminMobileNav } from '@/components/admin/AdminNav';
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
      <header className="relative z-40 border-b border-border-subtle bg-surface">
        <div className="relative flex min-h-control items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={32} alt={adminUi.shell.adminTitle} />
            <span className="hidden truncate text-base font-bold text-text-primary sm:inline">
              {adminUi.shell.adminTitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-text-secondary sm:inline">
              {adminUi.shell.ownerSession}: نشطة
            </span>
            <form action={signOutOwner}>
              <button
                type="submit"
                className="min-h-control rounded-control border border-border-interactive bg-transparent px-3 text-sm font-semibold text-text-primary hover:bg-background sm:px-4"
              >
                {adminUi.shell.logout}
              </button>
            </form>
            <AdminMobileNav
              items={sections}
              label={adminUi.shell.navLabel}
              panelLabel={adminNavUi.panelLabel}
            />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="hidden border-e border-border-subtle bg-surface md:block md:w-64 md:shrink-0">
          <AdminDesktopNav items={sections} label={adminUi.shell.navLabel} />
        </aside>
        <main id="admin-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

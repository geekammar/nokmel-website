import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminUi } from '@/content/ar/admin';
import { getOwnerSession } from '@/lib/owner';
import { pageMetadata } from '@/lib/seo';
import { LoginForm } from './login-form';

export const metadata: Metadata = pageMetadata({
  title: adminUi.login.heading,
  description: adminUi.login.subheading,
  path: '/admin/login',
});

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const owner = await getOwnerSession().catch(() => null);
  if (owner) redirect('/admin');
  return (
    <main
      id="main-content"
      className="flex flex-1 items-center justify-center bg-background px-4 py-16"
    >
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </main>
  );
}

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { getOwnerSession } from '@/lib/owner';

export async function signOutOwner(): Promise<void> {
  const owner = await getOwnerSession();
  if (owner) {
    await getAuth().api.signOut({ headers: await headers() });
  }
  redirect('/admin/login');
}

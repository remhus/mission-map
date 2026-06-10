import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');

  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get('sidebar-collapsed')?.value === 'true';

  return (
    <AppShell username={user.username} initialCollapsed={sidebarCollapsed}>
      {children}
    </AppShell>
  );
}

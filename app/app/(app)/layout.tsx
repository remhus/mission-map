import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import AppShell from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <AppShell username={user.username}>
      {children}
    </AppShell>
  );
}

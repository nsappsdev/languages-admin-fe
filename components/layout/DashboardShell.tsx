'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { useAuth } from '../providers/AuthProvider';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/lessons', label: 'Lessons' },
  { href: '/dashboard/vocabulary', label: 'Vocabulary' },
  { href: '/dashboard/learners', label: 'Learners' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export const DashboardShell = ({ children }: PropsWithChildren) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 border-r border-slate-200 bg-white px-6 py-8 hidden md:flex md:flex-col">
        <div className="text-xl font-semibold text-brand-600 mb-8">Language Admin</div>
        <nav className="flex-1 space-y-2">
          {NAV_LINKS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <div>
          <p className="text-xs uppercase text-slate-400 mb-1">{user?.name}</p>
          <button
            onClick={handleLogout}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Welcome back</p>
            <h1 className="text-2xl font-semibold text-slate-900">{user?.name}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="md:hidden rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600"
          >
            Logout
          </button>
        </header>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">{children}</div>
      </main>
    </div>
  );
};

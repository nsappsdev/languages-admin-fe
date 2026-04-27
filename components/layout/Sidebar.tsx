'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/lessons', label: 'Lessons' },
  { href: '/dashboard/vocabulary', label: 'Vocabulary' },
  { href: '/dashboard/learners', label: 'Learners' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href);
  };

  return (
    <aside className="hidden md:flex md:flex-col w-56 lg:w-64 border-r border-slate-200 bg-white px-4 py-6">
      <div className="text-lg font-semibold text-brand-600 mb-6">Language Admin</div>
      <nav className="flex-1 space-y-1">
        {NAV_LINKS.map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-brand-50 text-brand-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-xs uppercase text-slate-400 mb-2 truncate">{user?.name}</p>
        <button
          onClick={handleLogout}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Logout
        </button>
      </div>
    </aside>
  );
};

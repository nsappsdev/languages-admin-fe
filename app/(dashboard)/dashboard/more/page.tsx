'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../components/providers/AuthProvider';

const LINKS = [
  { href: '/dashboard/settings', label: 'Settings', desc: 'App settings, fonts, repetitions' },
];

export default function MorePage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400">Signed in as</p>
        <p className="mt-1 text-base font-semibold text-slate-900 truncate">{user?.name}</p>
        <p className="text-sm text-slate-500 truncate">{user?.email}</p>
      </div>

      <nav className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between px-3 sm:px-4 py-3 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500 truncate">{item.desc}</p>
            </div>
            <span className="text-slate-400">›</span>
          </Link>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-3 text-sm font-medium text-rose-600 shadow-sm hover:bg-rose-50"
      >
        Logout
      </button>
    </div>
  );
}

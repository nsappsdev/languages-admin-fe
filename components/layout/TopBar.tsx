'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

export const TopBar = () => {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-6 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-slate-500">Welcome back</p>
        <h1 className="text-base sm:text-xl font-semibold text-slate-900 truncate">
          {user?.name}
        </h1>
      </div>
      <button
        onClick={handleLogout}
        className="hidden md:inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
      >
        Logout
      </button>
    </header>
  );
};

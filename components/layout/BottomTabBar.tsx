'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

type Tab = {
  href: string;
  label: string;
  icon: ReactNode;
  matchPrefix?: boolean;
};

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    {children}
  </svg>
);

const TABS: Tab[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" />
      </Icon>
    ),
  },
  {
    href: '/dashboard/lessons',
    label: 'Lessons',
    matchPrefix: true,
    icon: (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16" />
      </Icon>
    ),
  },
  {
    href: '/dashboard/vocabulary',
    label: 'Vocab',
    matchPrefix: true,
    icon: (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
      </Icon>
    ),
  },
  {
    href: '/dashboard/learners',
    label: 'Learners',
    matchPrefix: true,
    icon: (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8zm6 0a4 4 0 100-6 4 4 0 000 6zm-12 0a4 4 0 100-6 4 4 0 000 6z" />
      </Icon>
    ),
  },
  {
    href: '/dashboard/more',
    label: 'More',
    matchPrefix: true,
    icon: (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </Icon>
    ),
  },
];

export const BottomTabBar = () => {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (tab: Tab) => {
    if (tab.matchPrefix) return pathname?.startsWith(tab.href);
    return pathname === tab.href;
  };

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white border-t border-slate-200 flex"
    >
      {TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
              active ? 'text-brand-600' : 'text-slate-500'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

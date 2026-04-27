'use client';

import { PropsWithChildren } from 'react';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';

export const DashboardShell = ({ children }: PropsWithChildren) => {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <TopBar />
        <PageContainer>{children}</PageContainer>
      </main>
      <BottomTabBar />
    </div>
  );
};

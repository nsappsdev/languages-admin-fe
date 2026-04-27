'use client';

import type { PropsWithChildren } from 'react';

export const PageContainer = ({ children }: PropsWithChildren) => (
  <div className="flex-1 p-2 sm:p-4">{children}</div>
);

'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useLearners } from '../../../../hooks/useLearners';

export default function LearnersPage() {
  const { data, isLoading, error } = useLearners();
  const learners = data?.learners ?? [];

  let content: ReactNode;
  if (isLoading) {
    content = <p className="text-sm text-slate-500">Loading learners…</p>;
  } else if (error) {
    content = <p className="text-sm text-rose-600">Failed to load learners: {error.message}</p>;
  } else if (!learners.length) {
    content = <p className="text-sm text-slate-500">No learner accounts found yet.</p>;
  } else {
    content = (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Email</th>
              <th className="py-2 pr-3 font-medium">Joined</th>
              <th className="py-2 pr-3 font-medium">Saved Vocab</th>
              <th className="py-2 font-medium">Progress Events</th>
              <th className="py-2 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {learners.map((learner) => (
              <tr key={learner.id} className="text-slate-700">
                <td className="py-3 pr-3 font-medium text-slate-900">
                  <Link href={`/dashboard/learners/${learner.id}`} className="hover:text-brand-600">
                    {learner.name}
                  </Link>
                </td>
                <td className="py-3 pr-3">{learner.email}</td>
                <td className="py-3 pr-3">{new Date(learner.createdAt).toLocaleDateString()}</td>
                <td className="py-3 pr-3">{learner.vocabularySaved}</td>
                <td className="py-3">{learner.progressEvents}</td>
                <td className="py-3 text-right">
                  <Link href={`/dashboard/learners/${learner.id}`} className="text-sm text-brand-600">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Learners</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Accounts created from the mobile app signup flow.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">{content}</div>
    </div>
  );
}

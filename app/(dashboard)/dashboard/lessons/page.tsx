'use client';
import Link from 'next/link';
import { useLessons } from '../../../../hooks/useLessons';
export default function LessonsPage() {
  const { data, isLoading, error } = useLessons();
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Lessons</h1><Link href="/dashboard/lessons/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">New lesson</Link></div>
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white p-4">
      {isLoading ? <p>Loading lessons…</p> : null}
      {error ? <p role="alert">Unable to load lessons.</p> : null}
      {data?.lessons.map(lesson => <Link key={lesson.id} href={`/dashboard/lessons/${lesson.id}`} className="block py-4"><p className="font-semibold">{lesson.title}</p><p className="mt-1 text-sm text-slate-500">{lesson.items.length} texts · {lesson.currentPublicationId ? 'Published' : 'Draft'}</p></Link>)}
      {data && !data.lessons.length ? <p>No lessons yet. Create one to begin.</p> : null}
    </div>
  </div>;
}

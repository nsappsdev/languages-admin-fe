'use client';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLesson } from '../../../../../hooks/useLesson';
import { useLessonMutations } from '../../../../../hooks/useLessonMutations';
import { ApiError, useApiClient } from '../../../../../hooks/useApiClient';
import { TextAuthoringPanel } from '../../../../../components/lesson-text/TextAuthoringPanel';
import { TextReadiness } from '../../../../../lib/textAuthoringTypes';

interface TextError { textId: string; order: number; readiness?: TextReadiness; message?: string }
const secondary = 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-40';

export default function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { data, isLoading, error } = useLesson(lessonId);
  const { request } = useApiClient();
  const queries = useQueryClient();
  const { updateLesson, createItem } = useLessonMutations();
  const lesson = data?.lesson;
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [openTexts, setOpenTexts] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [busyTexts, setBusyTexts] = useState<Record<string, boolean>>({});
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [textErrors, setTextErrors] = useState<TextError[]>([]);
  const onBusyChange = useCallback((id: string, busy: boolean) => setBusyTexts(previous => previous[id] === busy ? previous : { ...previous, [id]: busy }), []);
  const run = async (action: () => Promise<void>) => {
    setActionError(null); setMessage(null);
    try { await action(); } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Unable to save lesson'); }
  };
  if (isLoading) return <p>Loading lesson…</p>;
  if (error || !lesson) return <p role="alert">Unable to load lesson.</p>;
  const saveMetadata = async () => {
    await updateLesson.mutateAsync({ lessonId, data: { title: title ?? lesson.title, description: description ?? lesson.description ?? '' } });
    setTitle(null); setDescription(null);
  };
  const refresh = async () => {
    await Promise.all([
      queries.invalidateQueries({ queryKey: ['lesson', lessonId] }),
      queries.invalidateQueries({ queryKey: ['lessons'] }),
      queries.invalidateQueries({ queryKey: ['text-readiness', lessonId] }),
      queries.invalidateQueries({ queryKey: ['text-occurrences', lessonId] }),
    ]);
  };
  const publish = async () => {
    if (publishing) return;
    setPublishing(true); setActionError(null); setMessage(null); setTextErrors([]);
    try {
      await saveMetadata();
      await request(`/admin/lessons/${lessonId}/publish`, { method: 'POST', body: '{}' });
      await refresh();
      setMessage('Published. This lesson is now available in the learning app.');
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Unable to publish lesson');
      if (failure instanceof ApiError) {
        const errors = (failure.details as { texts?: TextError[] })?.texts ?? [];
        setTextErrors(errors);
        setOpenTexts(previous => ({ ...previous, ...Object.fromEntries(errors.map(issue => [issue.textId, true])) }));
        if (errors[0]) document.getElementById(`text-card-${errors[0].textId}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
      await refresh();
    } finally { setPublishing(false); }
  };
  const reorder = async (index: number, direction: number) => {
    const items = lesson.items.map(i => ({ id: i.id }));
    [items[index], items[index + direction]] = [items[index + direction], items[index]];
    await updateLesson.mutateAsync({ lessonId, data: { items } });
  };
  const pending = updateLesson.isPending || createItem.isPending;
  const unsaved = Object.values(busyTexts).some(Boolean) || !!newText.trim();
  return <div className="mx-auto max-w-6xl space-y-5 pb-8">
    <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-2 py-3">
      <div><h1 className="text-2xl font-semibold text-slate-900">{lesson.title}</h1><p className="mt-1 text-sm text-slate-500">{lesson.currentPublicationId ? 'Published' : 'Draft'} · {lesson.items.length} texts</p></div>
      <button type="button" disabled={publishing || pending || unsaved} onClick={() => void publish()} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {publishing ? 'Preparing clips and publishing…' : lesson.currentPublicationId ? 'Update published lesson' : 'Publish'}
      </button>
    </div>
    {unsaved ? <p role="status" className="text-sm text-amber-800">Save text and translation changes, and wait for narration to finish before publishing.</p> : null}
    {publishing ? <p role="status" className="text-sm text-slate-600">Checking every text and extracting missing word clips from its narration…</p> : null}
    {message ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    {actionError ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}
    <fieldset disabled={publishing} className="min-w-0 space-y-5">
      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700 focus-visible:outline-brand-500">Lesson details <span className="ml-2 font-normal text-slate-600">Edit title and description</span></summary>
        <section className="mt-4 space-y-3">
        <div><label htmlFor="lesson-title" className="text-sm font-medium text-slate-700">Title</label><input id="lesson-title" value={title ?? lesson.title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></div>
        <div><label htmlFor="lesson-description" className="text-sm font-medium text-slate-700">Description</label><textarea id="lesson-description" value={description ?? lesson.description ?? ''} onChange={e => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></div>
        <button type="button" className={secondary} disabled={pending} onClick={() => void run(async () => { await saveMetadata(); setMessage('Lesson details saved.'); })}>Save details</button>
      </section>
      </details>
      {lesson.items.map((item, index) => {
        const issue = textErrors.find(e => e.textId === item.id);
        const isOpen = openTexts[item.id] ?? index === 0;
        return <article id={`text-card-${item.id}`} key={item.id} aria-label={`Text ${index + 1}`} className={`space-y-4 rounded-xl border bg-white p-4 sm:p-5 ${issue ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="min-w-0 flex-1 text-base font-semibold"><button type="button" aria-expanded={isOpen} aria-controls={`text-editor-${item.id}`} onClick={() => setOpenTexts(previous => ({ ...previous, [item.id]: !isOpen }))}
              className="flex w-full items-center gap-3 rounded py-2 text-left text-slate-900 focus-visible:outline-brand-500"><span className="shrink-0">Text {index + 1}</span><span className="truncate text-sm font-normal text-slate-600">{item.text}</span><span className="ml-auto shrink-0 text-xs text-brand-600">{isOpen ? 'Collapse' : 'Expand'}{busyTexts[item.id] ? ' · Unsaved' : ''}</span></button></h2>
            <div className="flex gap-2">
              <button type="button" aria-label={`Move text ${index + 1} up`} disabled={index === 0 || pending} className={secondary} onClick={() => void run(() => reorder(index, -1))}>↑</button>
              <button type="button" aria-label={`Move text ${index + 1} down`} disabled={index === lesson.items.length - 1 || pending} className={secondary} onClick={() => void run(() => reorder(index, 1))}>↓</button>
              <button type="button" className={secondary} disabled={lesson.items.length === 1 || pending || busyTexts[item.id]} onClick={() => void run(async () => { await updateLesson.mutateAsync({ lessonId, data: { items: lesson.items.filter(i => i.id !== item.id).map(i => ({ id: i.id })) } }); })}>Remove text</button>
            </div>
          </div>
          {issue ? <p role="alert" className="text-sm text-rose-700">{issue.message ?? 'Complete the readiness steps below, then publish again.'}</p> : null}
          <div id={`text-editor-${item.id}`} hidden={!isOpen}><TextAuthoringPanel lessonId={lessonId} textId={item.id} onBusyChange={onBusyChange} /></div>
        </article>;
      })}
      {adding ? <section className="space-y-3 rounded-xl border border-dashed border-slate-300 p-4">
        <label htmlFor="new-text" className="text-sm font-medium">New text</label><textarea id="new-text" value={newText} onChange={e => setNewText(e.target.value)} maxLength={5000} rows={5} className="w-full rounded-lg border border-slate-300 p-3" />
        <button type="button" className={secondary} disabled={!newText.trim() || pending} onClick={() => void run(async () => { await createItem.mutateAsync({ lessonId, text: newText }); setNewText(''); setAdding(false); })}>Add text</button>
        <button type="button" className="ml-3 text-xs text-slate-500" onClick={() => { setAdding(false); setNewText(''); }}>Cancel</button>
      </section> : <button type="button" className={secondary} onClick={() => setAdding(true)}>+ Add text</button>}
      {lesson.currentPublicationId ? <div className="border-t border-slate-200 pt-4"><button type="button" className="text-xs text-slate-500 underline" onClick={() => void run(async () => {
        await request(`/admin/lessons/${lessonId}/unpublish`, { method: 'POST', body: '{}' }); await refresh(); setMessage('Lesson unpublished.');
      })}>Unpublish lesson</button></div> : null}
    </fieldset>
  </div>;
}

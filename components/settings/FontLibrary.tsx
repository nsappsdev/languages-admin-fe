'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../hooks/useApiClient';
import type { ReaderFont } from '../../lib/apiTypes';

const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export function FontLibrary({ fonts }: { fonts: ReaderFont[] }) {
  const { request } = useApiClient(); const queries = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [label,setLabel] = useState(''); const [file,setFile] = useState<File | null>(null);
  const [pending,setPending] = useState(false); const [error,setError] = useState(''); const [notice,setNotice] = useState('');
  const refresh = () => queries.invalidateQueries({ queryKey:['reader-fonts'] });
  const run = async (action: () => Promise<void>) => {
    setPending(true); setError(''); setNotice('');
    try { await action(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to manage fonts.'); }
    finally { setPending(false); }
  };
  const upload = () => void run(async () => {
    if (!file || !label.trim()) throw new Error('Choose a font file and enter its label.');
    if (file.size > 3*1024*1024 || !/\.(ttf|otf)$/i.test(file.name)) throw new Error('Choose a TTF or OTF font up to 3 MB.');
    const base64 = await new Promise<string>((resolve,reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Unable to read this file.')); reader.readAsDataURL(file);
    });
    const result = await request<{font:ReaderFont}>('/admin/reader-fonts',{ method:'POST',body:JSON.stringify({ label:label.trim(),fileName:file.name,base64 }) });
    setLabel(''); setFile(null); if (input.current) input.current.value='';
    setNotice(result.font.archivedAt ? 'This file is already in the library. Restore it below to use it.' : 'Font added. Select it in English or Armenian, then save reader appearance.');
  });
  return <div className="space-y-4">
    <p className="text-sm text-slate-600">Upload TTF or OTF files up to 3 MB. Add regular and bold faces separately; each file appears as its own choice. Letter support is checked automatically.</p>
    <fieldset disabled={pending} className="space-y-3 rounded-lg border border-slate-200 p-4">
      <label className="block text-sm font-medium text-slate-700">Font label<input value={label} maxLength={100} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Noto Sans Armenian — Regular" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
      <label className="block text-sm font-medium text-slate-700">Font file<input ref={input} type="file" accept=".ttf,.otf" onChange={e=>setFile(e.target.files?.[0]??null)} className="mt-1 block w-full text-sm" /></label>
      <button type="button" className={button} disabled={!file || !label.trim()} onClick={upload}>{pending?'Working…':'Upload font'}</button>
    </fieldset>
    {error?<p role="alert" className="text-sm text-rose-700">{error}</p>:null}
    {notice?<p role="status" className="text-sm text-emerald-800">{notice}</p>:null}
    {!fonts.length?<p className="text-sm text-slate-600">No uploaded fonts yet. The reader uses the device’s system font.</p>:null}
    <ul className="divide-y divide-slate-200">{fonts.map(font=><li key={font.id} className="space-y-2 py-3">
      <div><p className="break-words text-sm font-semibold text-slate-900">{font.label}{font.archivedAt?' · Archived':''}</p><p className="text-xs text-slate-600">{font.familyName} · {font.subfamilyName} · {[font.supportsEnglish?'English':null,font.supportsArmenian?'Armenian':null].filter(Boolean).join(', ')}{font.inUse?' · Used in reader':''}{!font.available?' · File unavailable':''}</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`font-label-${font.id}`}>Rename {font.label}</label>
        <input id={`font-label-${font.id}`} defaultValue={font.label} key={font.label} maxLength={100} disabled={pending} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" onKeyDown={e=>{ if(e.key==='Enter') {e.preventDefault();e.currentTarget.blur();} }} onBlur={e=>{const next=e.target.value.trim();if(next && next!==font.label) void run(async()=>{await request(`/admin/reader-fonts/${font.id}`,{method:'PATCH',body:JSON.stringify({label:next})});});}} />
        <button type="button" disabled={pending || !!font.inUse} title={font.inUse?'Save a replacement font before archiving.':undefined} className={button} onClick={()=>void run(async()=>{await request(`/admin/reader-fonts/${font.id}`,{method:'PATCH',body:JSON.stringify({archived:!font.archivedAt})});setNotice(font.archivedAt?'Font restored.':'Font archived.');})}>{font.archivedAt?'Restore':'Archive'}</button>
      </div>
    </li>)}</ul>
  </div>;
}

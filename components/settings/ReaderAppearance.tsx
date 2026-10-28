'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AppSettings } from '../../lib/apiTypes';
import { appearanceError, readerAppearance, ReaderAppearance as AppearanceDraft } from '../../lib/readerAppearance';
import { useApiClient } from '../../hooks/useApiClient';
import { useReaderFonts } from '../../hooks/useReaderFonts';
import { useFontPreview } from './useFontPreview';
import { FontLibrary } from './FontLibrary';
import { ReaderPreview } from './ReaderPreview';

const input='mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-brand-600';
export function ReaderAppearance({settings}:{settings:AppSettings}) {
  const {request}=useApiClient(); const queries=useQueryClient(); const library=useReaderFonts();
  const [draft,setDraft]=useState(()=>readerAppearance(settings));
  const [base,setBase]=useState(settings.updatedAt); const [tab,setTab]=useState('English');
  const [pending,setPending]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
  const fonts=library.data?.fonts??[];
  const mainFont=fonts.find(f=>f.id===draft.mainTextFontId), translationFont=fonts.find(f=>f.id===draft.translationFontId);
  const main=useFontPreview(mainFont), translation=useFontPreview(translationFont);
  const validation=appearanceError(draft);
  const change=<K extends keyof AppearanceDraft>(key:K,value:AppearanceDraft[K])=>{setDraft(old=>({...old,[key]:value}));setNotice('');};
  const save=async()=>{
    if(validation||pending)return;setPending(true);setError('');setNotice('');
    try {
      const result=await request<{settings:AppSettings}>('/settings',{method:'PATCH',body:JSON.stringify({...draft,translationFontSize:draft.translationFontMaxSize,expectedUpdatedAt:base})});
      setDraft(readerAppearance(result.settings));setBase(result.settings.updatedAt);setNotice('Reader appearance saved. Learners will see it when they reopen a lesson.');
      await Promise.all([queries.invalidateQueries({queryKey:['settings']}),queries.invalidateQueries({queryKey:['reader-fonts']})]);
    }catch(e){setError(e instanceof Error?e.message:'Unable to save reader appearance.');}finally{setPending(false);}
  };
  const reload=()=>{setDraft(readerAppearance(settings));setBase(settings.updatedAt);setError('');setNotice('Latest saved appearance loaded.');};
  const fontSelect=(role:'mainText'|'translation')=>{
    const idKey=role==='mainText'?'mainTextFontId':'translationFontId'; const familyKey=role==='mainText'?'mainTextFontFamily':'translationFontFamily';
    return <label className="block text-sm font-medium text-slate-700">{role==='mainText'?'English':'Armenian'} font
      <select className={input} value={draft[idKey]??(draft[familyKey]==='System'?'':`legacy:${draft[familyKey]}`)} onChange={e=>{
        setDraft(old=>({...old,[idKey]:e.target.value||null,[familyKey]:'System'}));setNotice('');
      }}><option value="">System (device default)</option>
        {!draft[idKey]&&draft[familyKey]!=='System'?<option value={`legacy:${draft[familyKey]}`}>Current device font: {draft[familyKey]}</option>:null}
        {fonts.filter(f=>!f.archivedAt&&f.available&&(role==='mainText'?f.supportsEnglish:f.supportsArmenian)).map(f=><option value={f.id} key={f.id}>{f.label} · {f.subfamilyName}</option>)}
      </select>
    </label>;
  };
  const number=(key:keyof AppearanceDraft,label:string,min:number,max:number,step=1)=> <label className="block text-sm font-medium text-slate-700" key={key}>{label}<input className={input} type="number" min={min} max={max} step={step} value={Number.isFinite(draft[key])?String(draft[key]):''} onChange={e=>change(key,e.target.value===''?NaN:Number(e.target.value))} /><span className="mt-1 block text-xs font-normal text-slate-600">{min}–{max}{step===1?'':' · decimals allowed'}</span></label>;
  const fallback=(family:string)=>family==='System'?'system-ui':family;
  return <section aria-labelledby="reader-appearance-title" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div><h2 id="reader-appearance-title" className="text-lg font-semibold text-slate-900">Lesson reader appearance</h2><p className="mt-1 text-sm text-slate-600">Global reading defaults for English text and Armenian translations. Vocabulary screens and app controls keep their current styling.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Reader appearance sections">{['English','Armenian','Spacing','Fonts'].map(item=><button type="button" key={item} disabled={pending} aria-pressed={tab===item} onClick={()=>setTab(item)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${tab===item?'border-brand-500 bg-brand-50 text-brand-900':'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{item}</button>)}</div>
    {library.isError?<p role="alert" className="text-sm text-rose-700">Unable to load the font library. <button type="button" className="underline" onClick={()=>void library.refetch()}>Try again</button></p>:null}
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {tab==='English'?<>{fontSelect('mainText')}<div className="grid grid-cols-2 gap-3">{number('mainTextFontSize','English font size',12,32)}{number('mainTextLineHeight','English line height',1,2.5,0.05)}</div><p className="text-xs leading-relaxed text-slate-600">Line height is a multiple of font size. Uploaded files render their actual face, including regular or bold.</p></>:null}
        {tab==='Armenian'?<>{fontSelect('translation')}<div className="grid grid-cols-2 gap-3">{number('translationFontMinSize','Minimum translation size',6,20)}{number('translationFontMaxSize','Maximum translation size',6,24)}{number('translationLineHeight','Armenian line height',1,2.5,0.05)}{number('translationLetterSpacingMin','Minimum letter spacing',-2,4,0.1)}{number('translationLetterSpacingMax','Maximum letter spacing',-2,4,0.1)}</div><p className="text-xs leading-relaxed text-slate-600">Translations fit within this size range. Set minimum and maximum to the same value for a fixed size. Letter spacing is measured in points.</p></>:null}
        {tab==='Spacing'?<><div className="grid grid-cols-2 gap-3">{number('translationGap','Translation-to-English gap',0,32)}{number('readingRowGap','Gap between reading rows',0,48)}</div><p className="text-xs leading-relaxed text-slate-600">Both gaps are independent and measured in points. The preview shows their effect on wrapped rows.</p></>:null}
        {tab==='Fonts'?<FontLibrary fonts={fonts}/>:null}
      </fieldset>
      <div className="min-w-0"><ReaderPreview draft={validation?readerAppearance(settings):draft} mainFamily={main.family??fallback(draft.mainTextFontFamily)} translationFamily={translation.family??fallback(draft.translationFontFamily)}/>
        {main.loading||translation.loading?<p role="status" className="mt-2 text-xs text-slate-600">Loading preview font…</p>:null}
        {main.error||translation.error?<p role="alert" className="mt-2 text-sm text-rose-700">A preview font could not load. The preview is using a system fallback.</p>:null}
      </div>
    </div>
    {validation?<p role="alert" className="text-sm text-rose-700">{validation}</p>:null}
    {error?<p role="alert" className="text-sm text-rose-700">{error}</p>:null}
    {notice?<p role="status" className="text-sm text-emerald-800">{notice}</p>:null}
    <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4"><button type="button" disabled={pending||!!validation} onClick={()=>void save()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{pending?'Saving…':'Save reader appearance'}</button><button type="button" disabled={pending} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" onClick={reload}>Discard changes</button><button type="button" disabled={pending} className="px-2 py-2 text-sm font-medium text-brand-900 underline" onClick={()=>{setDraft(readerAppearance({}));setNotice('Default appearance loaded. Save to apply it.');}}>Use defaults</button></div>
  </section>;
}

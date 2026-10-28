'use client';
import { useEffect, useState } from 'react';
import type { ReaderAppearance } from '../../lib/readerAppearance';

const sample = [
  ['On',''],['Friday,','ուրբաթ օրը'],['Anna',''],['stopped by','այցելեց'],['a',''],['small','փոքր'],
  ['bookshop','գրախանութ'],['and',''],['picked up','վերցրեց'],['a',''],['book.','գիրք'],
];
export function ReaderPreview({ draft, mainFamily, translationFamily }: { draft:ReaderAppearance; mainFamily:string; translationFamily:string }) {
  const [width,setWidth]=useState(320);
  return <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">Lesson preview</h3><div className="flex gap-1">{[320,390].map(size=><button key={size} type="button" aria-pressed={width===size} className={`rounded border px-2 py-1 text-xs ${width===size?'border-brand-500 bg-brand-50 text-brand-900':'border-slate-300 text-slate-700'}`} onClick={()=>setWidth(size)}>{size} px</button>)}</div></div>
    <div className="max-w-full overflow-hidden rounded-xl border border-slate-300 bg-white px-5 py-6" style={{width}}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-600">Read & listen</p>
      <div className="flex flex-wrap items-end" aria-label="English passage with Armenian translations">
        {sample.map(([word,translation],index)=><PreviewWord key={index} word={word} translation={translation} draft={draft} mainFamily={mainFamily} translationFamily={translationFamily} />)}
      </div>
    </div>
    <p className="text-xs leading-relaxed text-slate-600">Armenian stays above its English word or phrase. Device font rendering can vary slightly; changes apply when a learner reopens the lesson.</p>
  </aside>;
}
function PreviewWord({word,translation,draft,mainFamily,translationFamily}:{word:string;translation:string;draft:ReaderAppearance;mainFamily:string;translationFamily:string}) {
  const [fit,setFit]=useState({size:draft.translationFontMaxSize,spacing:0,width:0});
  useEffect(()=>{
    const context=document.createElement('canvas').getContext('2d'); if(!context)return;
    context.font=`${draft.mainTextFontSize}px "${mainFamily}"`;
    const available=context.measureText(word).width;
    let size=draft.translationFontMaxSize, spacing=draft.translationLetterSpacingMin;
    const letters=Math.max(0,[...translation].length-1), weight=draft.translationFontId?'normal':'bold';
    for(;size>draft.translationFontMinSize;size--) {
      context.font=`${weight} ${size}px "${translationFamily}"`;
      if(context.measureText(translation).width+letters*spacing<=available)break;
    }
    context.font=`${weight} ${size}px "${translationFamily}"`;
    const glyphs=context.measureText(translation).width;
    spacing=Math.min(draft.translationLetterSpacingMax,Math.max(spacing,(available-glyphs)/Math.max(1,letters)));
    setFit({size,spacing,width:Math.max(available,glyphs+letters*spacing)});
  },[draft,mainFamily,translationFamily,translation,word]);
  const lane=Math.ceil(draft.translationFontMaxSize*draft.translationLineHeight);
  return <span className="inline-flex shrink-0 items-end" style={{marginBottom:draft.readingRowGap}}>
    <span className="relative inline-flex flex-col items-center" style={{paddingTop:lane+draft.translationGap}}>
      {translation?<span className="absolute top-0 whitespace-nowrap text-center text-brand-900" style={{fontFamily:translationFamily,fontWeight:draft.translationFontId?'normal':700,fontSize:fit.size,letterSpacing:fit.spacing,width:fit.width||undefined,height:lane,lineHeight:`${lane}px`}}>{translation}</span>:null}
      <span className="whitespace-nowrap text-slate-900" style={{fontFamily:mainFamily,fontSize:draft.mainTextFontSize,lineHeight:`${Math.ceil(draft.mainTextFontSize*draft.mainTextLineHeight)}px`}}>{word}</span>
    </span>
    <span style={{fontFamily:mainFamily,fontSize:draft.mainTextFontSize,lineHeight:`${Math.ceil(draft.mainTextFontSize*draft.mainTextLineHeight)}px`,whiteSpace:'pre'}}> </span>
  </span>;
}

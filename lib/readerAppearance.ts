import type { AppSettings } from './apiTypes';

export interface ReaderAppearance {
  mainTextFontFamily: AppSettings['mainTextFontFamily']; mainTextFontId: string | null; mainTextFontSize: number; mainTextLineHeight: number;
  translationFontFamily: AppSettings['translationFontFamily']; translationFontId: string | null;
  translationFontSize: number; translationFontMinSize: number; translationFontMaxSize: number;
  translationLetterSpacingMin: number; translationLetterSpacingMax: number;
  translationLineHeight: number; translationGap: number; readingRowGap: number;
}
export function readerAppearance(settings: Partial<AppSettings>): ReaderAppearance {
  return { mainTextFontFamily: settings.mainTextFontFamily ?? 'System', mainTextFontId: settings.mainTextFontId ?? null,
    mainTextFontSize: settings.mainTextFontSize ?? 18, mainTextLineHeight: settings.mainTextLineHeight ?? 4 / 3,
    translationFontFamily: settings.translationFontFamily ?? 'System', translationFontId: settings.translationFontId ?? null,
    translationFontSize: settings.translationFontSize ?? 12, translationFontMinSize: settings.translationFontMinSize ?? 8,
    translationFontMaxSize: settings.translationFontMaxSize ?? 15, translationLetterSpacingMin: settings.translationLetterSpacingMin ?? -0.2,
    translationLetterSpacingMax: settings.translationLetterSpacingMax ?? 0.8, translationLineHeight: settings.translationLineHeight ?? ((settings.translationFontMaxSize ?? 15) + 4) / (settings.translationFontMaxSize ?? 15),
    translationGap: settings.translationGap ?? 2, readingRowGap: settings.readingRowGap ?? 4 };
}
export function appearanceError(draft: ReaderAppearance): string | null {
  const limits: [keyof ReaderAppearance, number, number, boolean][] = [
    ['mainTextFontSize',12,32,true], ['mainTextLineHeight',1,2.5,false],
    ['translationFontMinSize',6,20,true], ['translationFontMaxSize',6,24,true],
    ['translationLetterSpacingMin',-2,4,false], ['translationLetterSpacingMax',-2,4,false],
    ['translationLineHeight',1,2.5,false], ['translationGap',0,32,false], ['readingRowGap',0,48,false],
  ];
  if (limits.some(([key,min,max,integer]) => { const value = draft[key]; return typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)); }))
    return 'Enter numbers within the limits shown beside each control.';
  if (draft.translationFontMinSize > draft.translationFontMaxSize) return 'Translation minimum size must not exceed its maximum.';
  if (draft.translationLetterSpacingMin > draft.translationLetterSpacingMax) return 'Minimum letter spacing must not exceed its maximum.';
  return null;
}

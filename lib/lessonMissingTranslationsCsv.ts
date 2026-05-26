import Papa from 'papaparse';
import type { LessonDictionaryCoverageItem } from './apiTypes';

const MISSING_TRANSLATION_HEADERS = ['englishText', 'translation'];

export function buildMissingTranslationsCsv(
  items: LessonDictionaryCoverageItem[],
  lessonTitle: string,
): string {
  return Papa.unparse({
    fields: MISSING_TRANSLATION_HEADERS,
    data: items.map((item) => ({
      englishText: item.text,
      translation: '',
    })),
  });
}

export function buildMissingTranslationsFilename(lessonTitle: string): string {
  const safeTitle = lessonTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeTitle || 'lesson'}-missing-translations.csv`;
}

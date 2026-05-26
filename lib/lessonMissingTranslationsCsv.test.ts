import {
  buildMissingTranslationsCsv,
  buildMissingTranslationsFilename,
} from './lessonMissingTranslationsCsv';
import type { LessonDictionaryCoverageItem } from './apiTypes';

const coverageItem = (
  overrides: Partial<LessonDictionaryCoverageItem>,
): LessonDictionaryCoverageItem => ({
  text: 'hello',
  normalizedText: 'hello',
  kind: 'WORD',
  entryId: 'entry-1',
  hasTranslation: false,
  hasArmenianTranslation: false,
  translations: [],
  ...overrides,
});

describe('buildMissingTranslationsCsv', () => {
  it('uses simple translation columns with empty translation cells', () => {
    const csv = buildMissingTranslationsCsv(
      [coverageItem({ text: 'hello, world', kind: 'PHRASE' })],
      'Daily Routine',
    );

    expect(csv.split('\n')[0].trim()).toBe('englishText,translation');
    expect(csv).toContain('"hello, world",');
    expect(csv).not.toContain('PHRASE');
    expect(csv).not.toContain('Missing Armenian translation for Daily Routine');
  });
});

describe('buildMissingTranslationsFilename', () => {
  it('creates a safe csv filename from the lesson title', () => {
    expect(buildMissingTranslationsFilename('Louis XIV')).toBe('louis-xiv-missing-translations.csv');
  });
});

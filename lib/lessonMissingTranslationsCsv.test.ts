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
  it('uses the vocabulary import columns with empty translation cells', () => {
    const csv = buildMissingTranslationsCsv(
      [coverageItem({ text: 'hello, world', kind: 'PHRASE' })],
      'Daily Routine',
    );

    expect(csv.split('\n')[0].trim()).toBe('englishText,translation,kind,notes,tags,usageExample');
    expect(csv).toContain('"hello, world",,PHRASE');
    expect(csv).toContain('Missing Armenian translation for Daily Routine');
    expect(csv).toContain('lesson-missing-translation');
  });
});

describe('buildMissingTranslationsFilename', () => {
  it('creates a safe csv filename from the lesson title', () => {
    expect(buildMissingTranslationsFilename('Louis XIV')).toBe('louis-xiv-missing-translations.csv');
  });
});

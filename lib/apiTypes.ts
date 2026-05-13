export type LessonStatus = 'DRAFT' | 'PUBLISHED';

export interface LessonItemSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface LessonItemWordTiming {
  id: string;
  text: string;
  normalizedText: string;
  startMs: number;
  endMs: number;
  order: number;
}

export interface LessonItemSentenceTiming {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  wordMarkIds: string[];
  order: number;
}

export interface LessonItem {
  id: string;
  lessonId: string;
  text: string;
  audioUrl: string;
  order: number;
  segments: LessonItemSegment[];
  wordTimings: LessonItemWordTiming[];
  sentenceTimings: LessonItemSentenceTiming[];
}

export interface UploadedAudioFile {
  audioUrl: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export type VocabularyKind = 'WORD' | 'PHRASE' | 'SENTENCE';

export interface VocabularyTranslation {
  id: string;
  languageCode: string;
  translation: string;
  usageExample?: string | null;
}

export interface VocabularyEntry {
  id: string;
  englishText: string;
  kind: VocabularyKind;
  notes?: string | null;
  tags: string[];
  translations: VocabularyTranslation[];
}

export interface LessonDictionaryCoverageItem {
  text: string;
  normalizedText: string;
  kind: VocabularyKind;
  entryId: string | null;
  hasTranslation: boolean;
  hasArmenianTranslation: boolean;
  translations: VocabularyTranslation[];
}

export interface LessonSummary {
  id: string;
  title: string;
  description?: string | null;
  status: LessonStatus;
  items: LessonItem[];
  dictionary?: VocabularyEntry[];
  dictionaryCoverage?: LessonDictionaryCoverageItem[];
}

export interface LearnerSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  vocabularySaved: number;
  progressEvents: number;
}

export interface LearnerLessonProgressSummary {
  lessonId: string;
  lessonTitle: string | null;
  lessonStatus: string | null;
  totalEvents: number;
  itemsStarted: number;
  itemsCompleted: number;
  bestCompletion: number | null;
  lastCompletion: number | null;
  lastActivityAt: string;
}

export interface LearnerProgressSummaryResponse {
  learner: LearnerSummary;
  lessonSummaries: LearnerLessonProgressSummary[];
}

export const REPETITION_OPTIONS = [3, 5, 20] as const;
export type RepetitionOption = (typeof REPETITION_OPTIONS)[number];
export type ReadingModeId = 'introduction' | 'teaching' | 'deep_learning';

export interface ReadingModeSettings {
  id: ReadingModeId;
  enabled: boolean;
  displayName: string;
  order: number;
  unknownWordRepetitions?: number;
  repeatSentenceWhenUnknownCountAtLeast?: number;
  sentenceRepetitions?: number;
}

export const MAIN_FONT_OPTIONS = [
  'System',
  'Georgia',
  'Times New Roman',
  'Arial',
  'Helvetica Neue',
  'Courier New',
] as const;
export type MainFontOption = (typeof MAIN_FONT_OPTIONS)[number];

export const TRANSLATION_FONT_OPTIONS = [
  'System',
  'Noto Sans Armenian',
  'Noto Serif Armenian',
  'Mshtakan',
  'Arian AMU',
  'Arial AMU',
  'Arial',
  'Georgia',
] as const;
export type TranslationFontOption = (typeof TRANSLATION_FONT_OPTIONS)[number];

export interface AppSettings {
  id: string;
  readingModes: ReadingModeSettings[];
  mainTextFontFamily: MainFontOption;
  mainTextFontSize: number;
  translationFontFamily: TranslationFontOption;
  translationFontSize: number;
  translationFontMinSize: number;
  translationFontMaxSize: number;
  translationLetterSpacingMin: number;
  translationLetterSpacingMax: number;
  createdAt: string;
  updatedAt: string;
}

export interface BulkImportRow {
  englishText: string;
  translation: string;
  kind?: VocabularyKind;
  notes?: string;
  tags?: string[];
  usageExample?: string;
}

export interface BulkImportResult {
  created: number;
  mergedTranslations: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export interface BulkDeleteResult {
  deleted: number;
}

export type LessonStatus = 'DRAFT' | 'PUBLISHED';
export interface LessonItem {
  id: string;
  lessonId: string;
  text: string;
  order: number;
}
export interface LessonSummary {
  id: string;
  title: string;
  description?: string | null;
  currentPublicationId: string | null;
  status: LessonStatus;
  items: LessonItem[];
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
  wordRepetitionPauseMs: number;
  updatePolicyEnabled: boolean;
  latestAndroidBuildNumber: number;
  minAndroidBuildNumber: number;
  latestIosBuildNumber: number;
  minIosBuildNumber: number;
  androidStoreUrl: string;
  iosStoreUrl: string;
  updateMessage: string;
  createdAt: string;
  updatedAt: string;
}

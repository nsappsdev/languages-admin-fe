export interface TextContentRevision {
  id: string;
  textId: string;
  sequence: number;
  text: string;
  textSha256: string;
  sourceLanguage: string;
}

export interface TextNarrationSummary {
  id: string;
  assetId: string;
  provider: string;
  model: string;
  voiceId: string;
  createdAt: string;
}

export type AlignmentStatus = 'OK' | 'NEEDS_REVIEW';

export interface TextAlignmentSummary {
  id: string;
  status: AlignmentStatus;
}

export interface TextWorkspaceDetail {
  id: string;
  lessonId: string;
  draftVersion: number;
  legacyText: string;
  contentRevision: TextContentRevision | null;
  narration: TextNarrationSummary | null;
  alignmentSummary: TextAlignmentSummary | null;
  approvedTextReleaseId: string | null;
  audioGenerationConfigured: boolean;
}

export type AudioJobKind = 'GENERATE_NARRATION' | 'EXTRACT_CLIPS';
export type AudioJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface AudioJobError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AudioJob {
  id: string;
  textId: string;
  kind: AudioJobKind;
  status: AudioJobStatus;
  attempt: number;
  resultAssetId: string | null;
  resultId: string | null;
  error: AudioJobError | null;
}

export interface OccurrenceSentence {
  id: string;
  text: string;
  charStart: number;
  charEnd: number;
  occurrenceIds: number[];
}

export interface WordOccurrenceDto {
  id: string;
  ordinal: number;
  text: string;
  charStart: number;
  charEnd: number;
  sentenceId: string;
  speechStartSample: number | null;
  speechEndSample: number | null;
  cutStartSample: number | null;
  cutEndSample: number | null;
  mappingStatus: 'MAPPED' | 'UNMAPPED';
  entryId: string | null;
  selected: boolean;
  translations: TextVocabularyTranslationDto[];
  clipAssetId: string | null;
}

export interface OccurrencesResponse {
  alignmentId: string;
  status: AlignmentStatus;
  sentences: OccurrenceSentence[];
  occurrences: WordOccurrenceDto[];
}

export interface TextVocabularyTranslationDto {
  id: string;
  languageCode: string;
  translation: string;
  usageExample?: string | null;
}

export interface TextVocabularyEntryDto {
  id: string;
  occurrenceId: string;
  selected: boolean;
  translations: TextVocabularyTranslationDto[];
}

export interface TextReadiness {
  narrationValid: boolean;
  alignmentStatus: AlignmentStatus | 'MISSING';
  selectedCount: number;
  selectedMissingTranslationCount: number;
  selectedMissingClipCount: number;
  eligibleEntryIds: string[];
  readyForApproval: boolean;
  reasonCodes: string[];
}

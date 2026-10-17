export interface LibraryAsset { id: string; frameCount: number; sampleRate: number }
export interface LibraryUsage {
  lessonId: string; lessonTitle: string; textId: string; textReleaseId: string;
  occurrenceId: string; sentence: string; current: boolean;
}
export interface LibraryRecording {
  id: string; voiceId: string; model: string; asset: LibraryAsset; available: boolean; usages: LibraryUsage[];
}
export interface LibraryMeaning {
  id: string; translation: string; preferences: { voiceId: string; recordingId: string }[]; recordings: LibraryRecording[];
}
export interface LibraryTerm { id: string; text: string; language: string; meanings: LibraryMeaning[] }
export interface LibrarySearch {
  terms: { id: string; text: string; language: string; translations: string[]; recordingCount: number }[];
  page: number; pageSize: number; total: number;
}

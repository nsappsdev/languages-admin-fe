export type LessonStatus = 'DRAFT' | 'PUBLISHED';

export type TaskType = 'PICK_ONE' | 'FILL_IN_BLANK' | 'MATCH';

export interface TaskOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface TaskSummary {
  id: string;
  prompt: string;
  type: TaskType;
  order: number;
  options: TaskOption[];
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

export interface LessonSummary {
  id: string;
  title: string;
  description?: string | null;
  status: LessonStatus;
  tasks: TaskSummary[];
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
  attemptEvents: number;
  correctAttempts: number;
  tasksCompleted: number;
  bestScore: number | null;
  lastScore: number | null;
  bestCompletion: number | null;
  lastActivityAt: string;
}

export interface LearnerProgressSummaryResponse {
  learner: LearnerSummary;
  lessonSummaries: LearnerLessonProgressSummary[];
}

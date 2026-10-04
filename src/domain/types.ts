export type SubjectKind = 'english' | 'german' | 'math' | 'course' | 'project' | 'custom'
export type Rating = 'forgot' | 'hard' | 'good' | 'easy'
export type QuizKind = 'spelling' | 'meaning' | 'context' | 'network'

export interface Subject {
  id: string; name: string; kind: SubjectKind; sortOrder: number; createdAt: string
}

export interface Task {
  id: string; subjectId: string; title: string; description: string; quantity: string
  estimatedMinutes: number; importance: number; difficulty: number
  deadline?: string; mastery?: number; status: 'pending' | 'doing' | 'done'
  createdAt: string; completedAt?: string; skippedOn?: string; postponedUntil?: string
  manualOrder?: number; listId?: string
}

export interface Exam {
  id: string; subjectId: string; name: string; date: string; importance: number
}

export interface Word {
  id: string; subjectId: string; language: 'en' | 'de'; word: string; meaning: string
  ipa?: string; partOfSpeech?: string; mnemonic?: string; example?: string; exampleCN?: string
  derivedWords?: string; affixFamily?: string; article?: string; plural?: string
  thirdPerson?: string; past?: string; perfect?: string; source?: string
  originalSentence?: string; note?: string; tags?: string[]; listId?: string
  status: 'inbox' | 'processed' | 'learning'; personalWeak: boolean; weakHistory: number
  difficulty: number; mastery: number; errorCount: number; reviewCount: number
  lastReviewedAt?: string; nextReviewAt?: string; createdAt: string
}

export interface WordList {
  id: string; subjectId: string; language: 'en' | 'de'; number: number
  wordIds: string[]; status: 'new' | 'learning' | 'done'; createdAt: string
}

export interface Mistake {
  id: string; subjectId: string; topic: string; title: string; source?: string
  problem: string; myError: string; correctMethod: string; keyInsight: string
  difficulty: number; errorType: 'concept' | 'calculation' | 'method' | 'careless' | 'unknown'
  imageData?: string; createdAt: string; nextReviewAt?: string; lastReviewedAt?: string
  mastery: number; reviewCount: number; mastered: boolean
}

export interface Topic {
  id: string; subjectId: string; name: string; mastery: number; importance: number
  nextReviewAt?: string; lastReviewedAt?: string; reviewCount: number
}

export interface StudySession {
  id: string; subjectId: string; taskId?: string; minutes: number; focusScore?: number
  kind: 'task' | 'review' | 'vocabulary' | 'mistake' | 'manual'; createdAt: string
}

export interface QuizResult {
  id: string; listId: string; wordId: string; kind: QuizKind; correct: boolean; createdAt: string
}

export interface Note { id: string; text: string; createdAt: string }
export interface DailyPlan { id: string; taskIds: string[]; plannedMinutes: number; savedAt: string }

export interface AppSettings {
  id: 'main'; onboardingDone: boolean; dailyMinutes: number; wordsPerList: number
  theme: 'light' | 'dark' | 'system'; fontScale: number; showIPA: boolean; showExampleCN: boolean
  defaultTimer: 0 | 25 | 50 | 90; selectedKinds: SubjectKind[]
  priorityWeights?: { exam: number; importance: number; weakness: number; review: number; deadline: number; continuity: number }
  reviewIntervals?: [number, number, number, number]
}

export interface Snapshot {
  subjects: Subject[]; tasks: Task[]; exams: Exam[]; words: Word[]; lists: WordList[]
  mistakes: Mistake[]; topics: Topic[]; sessions: StudySession[]; quizResults: QuizResult[]
  notes: Note[]; plans: DailyPlan[]; settings: AppSettings | null
}

export interface PlanItem { taskId: string; minutes: number; score: number; reasons: string[] }
export interface PlanResult { items: PlanItem[]; totalMinutes: number; availableMinutes: number }

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'main', onboardingDone: false, dailyMinutes: 120, wordsPerList: 50,
  theme: 'system', fontScale: 1, showIPA: true, showExampleCN: true,
  defaultTimer: 0, selectedKinds: ['english', 'german', 'math'],
  priorityWeights: { exam: 25, importance: 25, weakness: 20, review: 15, deadline: 10, continuity: 5 },
  reviewIntervals: [1, 3, 7, 14],
}

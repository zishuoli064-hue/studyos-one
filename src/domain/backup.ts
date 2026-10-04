import { z } from 'zod'
import type { Snapshot } from './types'

const id = z.string().min(1)
const date = z.string().min(1)
const subject = z.object({ id, name: z.string(), kind: z.enum(['english', 'german', 'math', 'course', 'project', 'custom']),
  sortOrder: z.number(), createdAt: date }).passthrough()
const task = z.object({ id, subjectId: id, title: z.string(), description: z.string(), quantity: z.string(),
  estimatedMinutes: z.number(), importance: z.number(), difficulty: z.number(),
  status: z.enum(['pending', 'doing', 'done']), createdAt: date }).passthrough()
const exam = z.object({ id, subjectId: id, name: z.string(), date, importance: z.number() }).passthrough()
const word = z.object({ id, subjectId: id, language: z.enum(['en', 'de']), word: z.string().min(1), meaning: z.string(),
  status: z.enum(['inbox', 'processed', 'learning']), personalWeak: z.boolean(), weakHistory: z.number(),
  difficulty: z.number(), mastery: z.number(), errorCount: z.number(), reviewCount: z.number(), createdAt: date }).passthrough()
const list = z.object({ id, subjectId: id, language: z.enum(['en', 'de']), number: z.number(),
  wordIds: z.array(id), status: z.enum(['new', 'learning', 'done']), createdAt: date }).passthrough()
const mistake = z.object({ id, subjectId: id, topic: z.string(), title: z.string(), problem: z.string(),
  myError: z.string(), correctMethod: z.string(), keyInsight: z.string(), difficulty: z.number(),
  errorType: z.enum(['concept', 'calculation', 'method', 'careless', 'unknown']),
  createdAt: date, mastery: z.number(), reviewCount: z.number(), mastered: z.boolean() }).passthrough()
const topic = z.object({ id, subjectId: id, name: z.string(), mastery: z.number(), importance: z.number(),
  reviewCount: z.number() }).passthrough()
const session = z.object({ id, subjectId: id, minutes: z.number(),
  kind: z.enum(['task', 'review', 'vocabulary', 'mistake', 'manual']), createdAt: date }).passthrough()
const quizResult = z.object({ id, listId: id, wordId: id,
  kind: z.enum(['spelling', 'meaning', 'context', 'network']), correct: z.boolean(), createdAt: date }).passthrough()
const note = z.object({ id, text: z.string(), createdAt: date }).passthrough()
const plan = z.object({ id, taskIds: z.array(id), plannedMinutes: z.number(), savedAt: date }).passthrough()
const settings = z.object({ id: z.literal('main'), onboardingDone: z.boolean(), dailyMinutes: z.number(),
  wordsPerList: z.number(), theme: z.enum(['light', 'dark', 'system']), fontScale: z.number(),
  showIPA: z.boolean(), showExampleCN: z.boolean(), defaultTimer: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(90)]),
  selectedKinds: z.array(z.enum(['english', 'german', 'math', 'course', 'project', 'custom'])),
  priorityWeights: z.object({ exam: z.number(), importance: z.number(), weakness: z.number(), review: z.number(),
    deadline: z.number(), continuity: z.number() }).optional(),
  reviewIntervals: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional() }).passthrough()
const snapshotSchema = z.object({
  subjects: z.array(subject), tasks: z.array(task), exams: z.array(exam), words: z.array(word),
  lists: z.array(list), mistakes: z.array(mistake), topics: z.array(topic), sessions: z.array(session),
  quizResults: z.array(quizResult), notes: z.array(note), plans: z.array(plan).default([]), settings: settings.nullable(),
})
const backupSchema = z.object({ version: z.literal(1), data: snapshotSchema })
const TABLES = ['subjects', 'tasks', 'exams', 'words', 'lists', 'mistakes', 'topics', 'sessions', 'quizResults', 'notes', 'plans'] as const

export function exportBackup(data: Snapshot): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
}

export function importBackup(json: string, current: Snapshot, mode: 'merge' | 'replace' = 'merge'): Snapshot {
  const parsed = backupSchema.parse(JSON.parse(json)).data as unknown as Snapshot
  if (mode === 'replace') return parsed
  const output = { ...current }
  for (const key of TABLES) {
    const present = new Set(current[key].map(item => item.id))
    // Existing device data wins on ID conflict. Import is additive by default.
    ;(output as Record<string, unknown>)[key] = [...current[key], ...parsed[key].filter(item => !present.has(item.id))]
  }
  output.settings = current.settings ?? parsed.settings
  return output
}

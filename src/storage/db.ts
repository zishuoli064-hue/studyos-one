import Dexie, { type Table } from 'dexie'
import type { AppSettings, DailyPlan, Exam, Mistake, Note, QuizResult, Snapshot, StudySession, Subject, Task, Topic, Word, WordList } from '../domain/types'
import { demoSnapshot } from './demo'

export class StudyStore extends Dexie {
  subjects!: Table<Subject, string>
  tasks!: Table<Task, string>
  exams!: Table<Exam, string>
  words!: Table<Word, string>
  lists!: Table<WordList, string>
  mistakes!: Table<Mistake, string>
  topics!: Table<Topic, string>
  sessions!: Table<StudySession, string>
  quizResults!: Table<QuizResult, string>
  notes!: Table<Note, string>
  plans!: Table<DailyPlan, string>
  settings!: Table<AppSettings, string>

  constructor(name = 'StudyOS-ONE') {
    super(name)
    this.version(1).stores({
      subjects: 'id, kind, sortOrder', tasks: 'id, subjectId, status, deadline, completedAt',
      exams: 'id, subjectId, date', words: 'id, subjectId, language, word, listId, status, nextReviewAt',
      lists: 'id, subjectId, language, number', mistakes: 'id, subjectId, nextReviewAt, mastered',
      topics: 'id, subjectId, nextReviewAt', sessions: 'id, subjectId, createdAt, kind',
      quizResults: 'id, listId, wordId, createdAt', notes: 'id, createdAt', settings: 'id',
    })
    this.version(2).stores({ plans: 'id, savedAt' })
  }
}

export const db = new StudyStore()
const TABLES = ['subjects', 'tasks', 'exams', 'words', 'lists', 'mistakes', 'topics', 'sessions', 'quizResults', 'notes', 'plans'] as const

export async function readSnapshot(store: StudyStore = db): Promise<Snapshot> {
  const [subjects, tasks, exams, words, lists, mistakes, topics, sessions, quizResults, notes, plans, settings] = await Promise.all([
    store.subjects.toArray(), store.tasks.toArray(), store.exams.toArray(), store.words.toArray(), store.lists.toArray(),
    store.mistakes.toArray(), store.topics.toArray(), store.sessions.toArray(), store.quizResults.toArray(),
    store.notes.toArray(), store.plans.toArray(), store.settings.get('main'),
  ])
  return { subjects, tasks, exams, words, lists, mistakes, topics, sessions, quizResults, notes, plans, settings: settings ?? null }
}

export async function replaceSnapshot(store: StudyStore, snapshot: Snapshot): Promise<void> {
  await store.transaction('rw', store.tables, async () => {
    for (const name of TABLES) {
      await store[name].clear()
      // All tables have the same string primary key, but TypeScript cannot infer a heterogeneous Dexie union here.
      const records = snapshot[name] as { id: string }[]
      if (records.length) await (store[name] as Table<{ id: string }, string>).bulkPut(records)
    }
    await store.settings.clear()
    if (snapshot.settings) await store.settings.put(snapshot.settings)
  })
}

export async function seedDemo(store: StudyStore, settings: AppSettings): Promise<void> {
  if (await store.subjects.count()) return
  const demo = demoSnapshot(settings)
  const subjects = demo.subjects.filter(subject => settings.selectedKinds.includes(subject.kind))
  const ids = new Set(subjects.map(subject => subject.id))
  await replaceSnapshot(store, { ...demo, subjects,
    tasks: demo.tasks.filter(item => ids.has(item.subjectId)), exams: demo.exams.filter(item => ids.has(item.subjectId)),
    words: demo.words.filter(item => ids.has(item.subjectId)), lists: demo.lists.filter(item => ids.has(item.subjectId)),
    mistakes: demo.mistakes.filter(item => ids.has(item.subjectId)), topics: demo.topics.filter(item => ids.has(item.subjectId)) })
}

export async function clearDemoData(store: StudyStore = db): Promise<void> {
  await store.transaction('rw', store.tables, async () => {
    for (const name of TABLES) await store[name].where('id').startsWith('demo-').delete()
    const plans = await store.plans.toArray()
    await store.plans.bulkPut(plans.map(plan => ({ ...plan, taskIds: plan.taskIds.filter(id => !id.startsWith('demo-')) })))
  })
}

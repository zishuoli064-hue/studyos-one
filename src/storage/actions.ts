import type { Snapshot } from '../domain/types'
import { type StudyStore, readSnapshot } from './db'

type Collection = Exclude<keyof Snapshot, 'settings'>
const COLLECTIONS: Collection[] = ['subjects', 'tasks', 'exams', 'words', 'lists', 'mistakes', 'topics', 'sessions', 'quizResults', 'notes']

export async function deleteSubject(store: StudyStore, subjectId: string): Promise<Partial<Snapshot>> {
  const data = await readSnapshot(store)
  const wordIds = new Set(data.words.filter(word => word.subjectId === subjectId).map(word => word.id))
  const listIds = new Set(data.lists.filter(list => list.subjectId === subjectId).map(list => list.id))
  const taskIds = new Set(data.tasks.filter(task => task.subjectId === subjectId).map(task => task.id))
  const removed: Partial<Snapshot> = {
    subjects: data.subjects.filter(subject => subject.id === subjectId),
    tasks: data.tasks.filter(task => task.subjectId === subjectId),
    exams: data.exams.filter(exam => exam.subjectId === subjectId),
    words: data.words.filter(word => word.subjectId === subjectId),
    lists: data.lists.filter(list => list.subjectId === subjectId),
    mistakes: data.mistakes.filter(mistake => mistake.subjectId === subjectId),
    topics: data.topics.filter(topic => topic.subjectId === subjectId),
    sessions: data.sessions.filter(session => session.subjectId === subjectId),
    quizResults: data.quizResults.filter(result => listIds.has(result.listId) || wordIds.has(result.wordId)),
    notes: [],
    plans: data.plans.filter(plan => plan.taskIds.some(id => taskIds.has(id))),
  }
  if (!removed.subjects?.length) throw new Error('Subject no longer exists')
  await store.transaction('rw', store.tables, async () => {
    for (const key of COLLECTIONS) {
      const ids = (removed[key] as { id: string }[] | undefined)?.map(item => item.id) ?? []
      if (ids.length) await store[key].bulkDelete(ids)
    }
    if (removed.plans?.length) await store.plans.bulkPut(removed.plans.map(plan => ({ ...plan,
      taskIds: plan.taskIds.filter(id => !taskIds.has(id)) })))
  })
  return removed
}

export async function restoreSubject(store: StudyStore, removed: Partial<Snapshot>): Promise<void> {
  await store.transaction('rw', store.tables, async () => {
    for (const key of COLLECTIONS) {
      const rows = removed[key] as { id: string }[] | undefined
      if (rows?.length) await (store[key] as typeof store.subjects).bulkPut(rows as never)
    }
    if (removed.plans?.length) await store.plans.bulkPut(removed.plans)
  })
}

/** Save feedback and the session atomically, so one task can only be completed once. */
export async function completeTask(store: StudyStore, taskId: string, feedback: {
  minutes: number; focusScore: number; mastery: number; note?: string
}, now = new Date().toISOString()): Promise<void> {
  if (!Number.isFinite(feedback.minutes) || feedback.minutes < 1 || feedback.minutes > 600) throw new Error('Minutes must be 1–600')
  if (!Number.isInteger(feedback.focusScore) || feedback.focusScore < 1 || feedback.focusScore > 5) throw new Error('Focus must be 1–5')
  if (!Number.isFinite(feedback.mastery) || feedback.mastery < 0 || feedback.mastery > 100) throw new Error('Mastery must be 0–100')
  await store.transaction('rw', store.tasks, store.sessions, store.notes, async () => {
    const task = await store.tasks.get(taskId)
    if (!task) throw new Error('Task no longer exists')
    if (task.status === 'done') throw new Error('Task is already complete')
    await store.tasks.put({ ...task, status: 'done', completedAt: now, mastery: Math.round(feedback.mastery) })
    await store.sessions.add({ id: crypto.randomUUID(), subjectId: task.subjectId, taskId,
      minutes: Math.round(feedback.minutes), focusScore: feedback.focusScore, kind: 'task', createdAt: now })
    if (feedback.note?.trim()) await store.notes.add({ id: crypto.randomUUID(), text: `${task.title}: ${feedback.note.trim()}`, createdAt: now })
  })
}

import type { Snapshot } from './types'
import { localDay } from './date'

/** Build a transparent seven-day summary from recorded activity and saved daily plans. */
export function calculateWeeklyReview(data: Snapshot, today: string) {
  const start = new Date(`${today}T12:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 6)
  const since = start.toISOString().slice(0, 10)
  const sessions = data.sessions.filter(session => localDay(new Date(session.createdAt)) >= since)
  const quiz = data.quizResults.filter(result => localDay(new Date(result.createdAt)) >= since)
  const completed = data.tasks.filter(task => task.completedAt && localDay(new Date(task.completedAt)) >= since)
  const plannedTaskIds = new Set(data.plans.filter(plan => plan.id >= since && plan.id <= today).flatMap(plan => plan.taskIds))
  const completedPlanned = completed.filter(task => plannedTaskIds.has(task.id)).length
  const mathIds = new Set(data.subjects.filter(subject => subject.kind === 'math').map(subject => subject.id))
  const germanIds = new Set(data.subjects.filter(subject => subject.kind === 'german').map(subject => subject.id))
  const mathErrorTypes = data.mistakes.filter(mistake => mathIds.has(mistake.subjectId))
    .reduce<Record<string, number>>((output, mistake) => {
      output[mistake.errorType] = (output[mistake.errorType] ?? 0) + 1
      return output
    }, {})
  return {
    since,
    minutes: sessions.reduce((sum, session) => sum + Math.max(0, session.minutes), 0),
    completedTasks: completed.length,
    quizAccuracy: quiz.length ? Math.round(quiz.filter(result => result.correct).length / quiz.length * 100) : null,
    planCompletion: plannedTaskIds.size ? Math.round(completedPlanned / plannedTaskIds.size * 100) : null,
    plannedTasks: plannedTaskIds.size,
    weakWords: [...data.words].filter(word => word.language === 'en' && word.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount).slice(0, 3),
    mathErrorTypes,
    germanMinutes: sessions.filter(session => germanIds.has(session.subjectId))
      .reduce((sum, session) => sum + Math.max(0, session.minutes), 0),
    germanWords: data.words.filter(word => germanIds.has(word.subjectId)).length,
  }
}

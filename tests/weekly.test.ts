import { describe, expect, it } from 'vitest'
import { calculateWeeklyReview } from '../src/domain/weekly'
import { demoSnapshot } from '../src/storage/demo'
import { DEFAULT_SETTINGS } from '../src/domain/types'

const today = '2026-10-03'
const base = () => demoSnapshot(DEFAULT_SETTINGS, new Date('2026-10-03T12:00:00.000Z'))

describe('seven-day review', () => {
  it('reports no plan completion when no plan was recorded', () => {
    const week = calculateWeeklyReview(base(), today)
    expect(week.planCompletion).toBeNull()
    expect(week.completedTasks).toBe(0)
    expect(week.weakWords.map(word => word.word)).toContain('ability')
  })

  it('integrates saved plans, task completion, sessions, quiz results, and subjects', () => {
    const data = base()
    data.plans.push({ id: today, taskIds: ['demo-task-en', 'demo-task-math'], plannedMinutes: 95, savedAt: '2026-10-03T12:00:00.000Z' })
    data.tasks[0] = { ...data.tasks[0], status: 'done', completedAt: '2026-10-03T13:00:00.000Z' }
    data.sessions.push({ id: 's', subjectId: 'demo-english', taskId: 'demo-task-en', minutes: 35, kind: 'task', createdAt: '2026-10-03T13:00:00.000Z' })
    data.sessions.push({ id: 'old', subjectId: 'demo-german', minutes: 99, kind: 'review', createdAt: '2026-09-01T13:00:00.000Z' })
    data.quizResults.push({ id: 'q1', listId: 'demo-list-en-1', wordId: 'demo-en-1', kind: 'meaning', correct: true, createdAt: '2026-10-03T14:00:00.000Z' })
    data.quizResults.push({ id: 'q2', listId: 'demo-list-en-1', wordId: 'demo-en-2', kind: 'meaning', correct: false, createdAt: '2026-10-03T14:00:00.000Z' })
    const week = calculateWeeklyReview(data, today)
    expect(week.minutes).toBe(35)
    expect(week.completedTasks).toBe(1)
    expect(week.quizAccuracy).toBe(50)
    expect(week.planCompletion).toBe(50)
    expect(week.mathErrorTypes.method).toBe(1)
    expect(week.germanWords).toBe(5)
  })
})

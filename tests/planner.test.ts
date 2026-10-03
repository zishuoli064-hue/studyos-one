import { describe, expect, it } from 'vitest'
import { planToday } from '../src/domain/planner'
import type { Task, Exam } from '../src/domain/types'

const day = '2026-10-03'
const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id, subjectId: 'english', title: id, description: '', quantity: '', estimatedMinutes: 40,
  importance: 3, difficulty: 3, status: 'pending', createdAt: day,
  ...overrides,
})

describe('daily planner', () => {
  it('selects the most useful tasks within available time', () => {
    const tasks = [task('later', { importance: 1, estimatedMinutes: 30 }),
      task('exam', { importance: 5, estimatedMinutes: 45, subjectId: 'math' }),
      task('weak', { importance: 4, estimatedMinutes: 30, mastery: 25 })]
    const exams = [{ id: 'e', subjectId: 'math', name: 'Math exam', date: '2026-10-05', importance: 5 }] as Exam[]
    const plan = planToday({ tasks, exams, availableMinutes: 75, today: day })
    expect(plan.items.map(item => item.taskId)).toEqual(['exam', 'weak'])
    expect(plan.totalMinutes).toBe(75)
    expect(plan.items[0].reasons.length).toBeGreaterThan(0)
  })

  it('never schedules completed, skipped, or postponed tasks', () => {
    const plan = planToday({ tasks: [task('done', { status: 'done' }), task('skip', { skippedOn: day }),
      task('postpone', { postponedUntil: '2026-10-04' }), task('keep')], exams: [], availableMinutes: 120, today: day })
    expect(plan.items.map(item => item.taskId)).toEqual(['keep'])
  })

  it('compresses one high priority task to fit a short day', () => {
    const plan = planToday({ tasks: [task('big', { estimatedMinutes: 60, importance: 5 })], exams: [], availableMinutes: 20, today: day })
    expect(plan.items[0].minutes).toBe(20)
    expect(plan.totalMinutes).toBe(20)
  })

  it('returns an empty plan without tasks or available time', () => {
    expect(planToday({ tasks: [], exams: [], availableMinutes: 120, today: day }).items).toEqual([])
    expect(planToday({ tasks: [task('a')], exams: [], availableMinutes: 0, today: day }).items).toEqual([])
  })
})

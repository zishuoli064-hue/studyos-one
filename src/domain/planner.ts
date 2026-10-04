import type { AppSettings, Exam, PlanResult, Task } from './types'

const DAY = 86_400_000
const WEIGHTS = { exam: 25, importance: 25, weakness: 20, review: 15, deadline: 10, continuity: 5 } as const

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY) : 999
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

export function scoreTask(task: Task, exams: Exam[], today: string, recentMinutes = 0,
  weights: AppSettings['priorityWeights'] = WEIGHTS): { score: number; reasons: string[] } {
  const nextExam = exams.filter(exam => exam.subjectId === task.subjectId && daysBetween(today, exam.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const examDays = nextExam ? daysBetween(today, nextExam.date) : 999
  const exam = nextExam ? clamp(100 - Math.min(examDays, 90) * 0.9) : 40
  const importance = clamp((task.importance - 1) * 25)
  const weakness = task.mastery === undefined ? 50 : clamp(100 - task.mastery)
  const review = task.mastery !== undefined && task.mastery < 60 ? 80 : 40
  const deadlineDays = task.deadline ? daysBetween(today, task.deadline) : 999
  const deadline = task.deadline ? clamp(deadlineDays < 0 ? 100 : 100 - Math.min(deadlineDays, 30) * 3) : 25
  const continuity = clamp(70 - Math.min(recentMinutes, 240) / 4)
  const configured = weights ?? WEIGHTS
  const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
  const w = { exam: safe(configured.exam), importance: safe(configured.importance), weakness: safe(configured.weakness),
    review: safe(configured.review), deadline: safe(configured.deadline), continuity: safe(configured.continuity) }
  const totalWeight = Object.values(w).reduce((sum, weight) => sum + weight, 0) || 1
  const score = Math.round(((exam * w.exam + importance * w.importance + weakness * w.weakness +
    review * w.review + deadline * w.deadline + continuity * w.continuity) / totalWeight) * 10) / 10
  const reasons: string[] = []
  if (nextExam && examDays <= 30) reasons.push(`${nextExam.name} in ${examDays} days`)
  if (task.mastery !== undefined && task.mastery < 65) reasons.push(`Mastery ${task.mastery}%`)
  if (task.deadline && deadlineDays <= 7) reasons.push(deadlineDays < 0 ? 'Overdue' : `Due in ${deadlineDays} days`)
  if (task.importance >= 4 && reasons.length < 3) reasons.push('High priority subject')
  return { score: clamp(score), reasons: reasons.slice(0, 3) }
}

export function planToday(input: {
  tasks: Task[]; exams: Exam[]; availableMinutes: number; today: string
  recentMinutesBySubject?: Record<string, number>; weights?: AppSettings['priorityWeights']
}): PlanResult {
  const availableMinutes = Math.max(0, Math.floor(Number.isFinite(input.availableMinutes) ? input.availableMinutes : 0))
  const ranked = input.tasks.filter(task => task.status !== 'done' && task.skippedOn !== input.today &&
    (!task.postponedUntil || task.postponedUntil <= input.today))
    .map(task => ({ task, ...scoreTask(task, input.exams, input.today, input.recentMinutesBySubject?.[task.subjectId] ?? 0, input.weights) }))
    .sort((a, b) => (a.task.manualOrder ?? 999) - (b.task.manualOrder ?? 999) || b.score - a.score || a.task.id.localeCompare(b.task.id))
  const items: PlanResult['items'] = []
  let remaining = availableMinutes
  for (const entry of ranked) {
    if (remaining < 15) break
    const duration = Math.max(15, Math.min(120, Math.floor(entry.task.estimatedMinutes || 40)))
    if (duration > remaining && items.length > 0) continue
    const minutes = Math.min(duration, remaining)
    items.push({ taskId: entry.task.id, minutes, score: entry.score, reasons: entry.reasons })
    remaining -= minutes
  }
  return { items, totalMinutes: availableMinutes - remaining, availableMinutes }
}

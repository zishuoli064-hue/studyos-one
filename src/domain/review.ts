import type { Rating } from './types'

const DAY = 86_400_000
const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function reviewIntervalDays(mastery: number, errorCount: number, reviewCount: number, rating: Rating,
  intervals: [number, number, number, number] = [1, 3, 7, 14]): number {
  const base = mastery < 60 ? intervals[0] : mastery < 75 ? intervals[1] : mastery < 90 ? intervals[2] : intervals[3]
  const ratingFactor = { forgot: 0.25, hard: 0.55, good: 1, easy: 1.5 }[rating]
  const errorFactor = errorCount >= 3 ? 0.65 : errorCount >= 1 ? 0.85 : 1
  const practiceFactor = mastery >= 85 ? Math.min(1.5, 1 + reviewCount * 0.05) : 1
  return Math.max(1, Math.min(30, Math.round(base * ratingFactor * errorFactor * practiceFactor)))
}

export function applyReview(input: {
  mastery: number; errorCount: number; reviewCount: number; rating: Rating; now: string
  intervals?: [number, number, number, number]
}): { mastery: number; errorCount: number; reviewCount: number; lastReviewedAt: string; nextReviewAt: string } {
  const delta = { forgot: -18, hard: -4, good: 6, easy: 10 }[input.rating]
  const mastery = clamp(Math.round(input.mastery + delta))
  const errorCount = Math.max(0, input.errorCount + (input.rating === 'forgot' ? 1 : input.rating === 'easy' ? -1 : 0))
  const reviewCount = Math.max(0, input.reviewCount) + 1
  const interval = reviewIntervalDays(mastery, errorCount, reviewCount, input.rating, input.intervals)
  const date = Date.parse(`${input.now.slice(0, 10)}T00:00:00Z`)
  const nextReviewAt = new Date(date + interval * DAY).toISOString().slice(0, 10)
  return { mastery, errorCount, reviewCount, lastReviewedAt: input.now, nextReviewAt }
}

export function dueForReview(nextReviewAt: string | undefined, today: string): boolean {
  return !nextReviewAt || nextReviewAt.slice(0, 10) <= today.slice(0, 10)
}

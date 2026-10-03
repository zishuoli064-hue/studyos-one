import { describe, expect, it } from 'vitest'
import { applyReview, dueForReview, reviewIntervalDays } from '../src/domain/review'

describe('review scheduler', () => {
  it('returns shorter intervals for forgotten and weak material', () => {
    expect(reviewIntervalDays(35, 2, 0, 'forgot')).toBe(1)
    expect(reviewIntervalDays(90, 0, 5, 'easy')).toBeGreaterThan(reviewIntervalDays(90, 0, 5, 'hard'))
  })

  it('schedules from the review date and keeps mastery in range', () => {
    const result = applyReview({ mastery: 100, errorCount: 0, reviewCount: 3, rating: 'easy', now: '2026-10-03' })
    expect(result.nextReviewAt > '2026-10-03').toBe(true)
    expect(result.mastery).toBeLessThanOrEqual(100)
    expect(result.reviewCount).toBe(4)
    expect(dueForReview(result.nextReviewAt, '2026-10-03')).toBe(false)
    expect(dueForReview(undefined, '2026-10-03')).toBe(true)
  })
})

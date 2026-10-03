import { describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../src/domain/backup'
import type { Snapshot } from '../src/domain/types'

const empty: Snapshot = { subjects: [], tasks: [], exams: [], words: [], lists: [], mistakes: [],
  topics: [], sessions: [], quizResults: [], notes: [], settings: null }

describe('backup', () => {
  it('round trips the complete snapshot', () => {
    const source: Snapshot = { ...empty, subjects: [{ id: 's', name: 'English', kind: 'english', sortOrder: 0, createdAt: '2026-10-03' }] }
    expect(importBackup(exportBackup(source), empty, 'replace')).toEqual(source)
  })

  it('rejects invalid backup and merges without erasing existing records', () => {
    expect(() => importBackup('{"subjects":[]}', empty, 'merge')).toThrow()
    const previous: Snapshot = { ...empty, notes: [{ id: 'a', text: 'keep', createdAt: '2026-10-03' }] }
    const incoming: Snapshot = { ...empty, notes: [{ id: 'b', text: 'add', createdAt: '2026-10-03' }] }
    expect(importBackup(exportBackup(incoming), previous, 'merge').notes.map(n => n.id)).toEqual(['a', 'b'])
  })
})

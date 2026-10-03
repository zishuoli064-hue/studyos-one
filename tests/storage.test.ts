import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { StudyStore, readSnapshot, replaceSnapshot, seedDemo, clearDemoData } from '../src/storage/db'
import { DEFAULT_SETTINGS } from '../src/domain/types'
import { completeTask, deleteSubject, restoreSubject } from '../src/storage/actions'

const stores: StudyStore[] = []
const createStore = () => {
  const store = new StudyStore(`studyos-test-${crypto.randomUUID()}`)
  stores.push(store)
  return store
}
afterEach(async () => { for (const store of stores.splice(0)) await store.delete() })

describe('IndexedDB persistence', () => {
  it('seeds useful sample data once and can clear only demo records', async () => {
    const store = createStore()
    await seedDemo(store, DEFAULT_SETTINGS)
    await seedDemo(store, DEFAULT_SETTINGS)
    const snapshot = await readSnapshot(store)
    expect(snapshot.words.filter(word => word.language === 'en').length).toBeGreaterThanOrEqual(10)
    expect(snapshot.words.filter(word => word.language === 'de').length).toBeGreaterThanOrEqual(5)
    expect(snapshot.topics.length + snapshot.mistakes.length).toBeGreaterThanOrEqual(3)
    const custom = { ...snapshot.subjects[0], id: 'custom', name: 'My subject' }
    await store.subjects.put(custom)
    await clearDemoData(store)
    expect((await readSnapshot(store)).subjects.map(subject => subject.id)).toEqual(['custom'])
  })

  it('replaces all stores from a backup snapshot', async () => {
    const store = createStore()
    await seedDemo(store, DEFAULT_SETTINGS)
    const first = await readSnapshot(store)
    await replaceSnapshot(store, { ...first, subjects: [], tasks: [], words: [] })
    const second = await readSnapshot(store)
    expect(second.subjects).toEqual([])
    expect(second.tasks).toEqual([])
    expect(second.words).toEqual([])
    expect(second.settings?.dailyMinutes).toBe(DEFAULT_SETTINGS.dailyMinutes)
  })

  it('completes a task with one study session and rejects duplicate completion', async () => {
    const store = createStore()
    await seedDemo(store, DEFAULT_SETTINGS)
    await completeTask(store, 'demo-task-en', { minutes: 28, focusScore: 4, mastery: 72, note: 'Better recall' }, '2026-10-03T10:00:00.000Z')
    expect((await store.tasks.get('demo-task-en'))?.status).toBe('done')
    expect((await store.tasks.get('demo-task-en'))?.mastery).toBe(72)
    expect((await store.sessions.toArray())).toMatchObject([{ taskId: 'demo-task-en', minutes: 28, focusScore: 4 }])
    expect(await store.notes.count()).toBe(1)
    await expect(completeTask(store, 'demo-task-en', { minutes: 10, focusScore: 3, mastery: 80 })).rejects.toThrow('already complete')
    expect(await store.sessions.count()).toBe(1)
    await expect(completeTask(store, 'absent', { minutes: 10, focusScore: 3, mastery: 80 })).rejects.toThrow('no longer exists')
  })

  it('rejects invalid task feedback without modifying records', async () => {
    const store = createStore()
    await seedDemo(store, DEFAULT_SETTINGS)
    await expect(completeTask(store, 'demo-task-en', { minutes: -2, focusScore: 4, mastery: 50 })).rejects.toThrow()
    await expect(completeTask(store, 'demo-task-en', { minutes: 5, focusScore: 7, mastery: 50 })).rejects.toThrow()
    await expect(completeTask(store, 'demo-task-en', { minutes: 5, focusScore: 4, mastery: 101 })).rejects.toThrow()
    expect((await store.tasks.get('demo-task-en'))?.status).toBe('pending')
    expect(await store.sessions.count()).toBe(0)
  })

  it('deletes and restores a subject with all linked data', async () => {
    const store = createStore()
    await seedDemo(store, DEFAULT_SETTINGS)
    await completeTask(store, 'demo-task-en', { minutes: 30, focusScore: 4, mastery: 70 })
    const before = await readSnapshot(store)
    const removed = await deleteSubject(store, 'demo-english')
    const after = await readSnapshot(store)
    expect(after.subjects.some(s => s.id === 'demo-english')).toBe(false)
    expect(after.words.some(w => w.subjectId === 'demo-english')).toBe(false)
    expect(after.sessions.some(s => s.subjectId === 'demo-english')).toBe(false)
    await restoreSubject(store, removed)
    expect(await readSnapshot(store)).toEqual(before)
  })
})

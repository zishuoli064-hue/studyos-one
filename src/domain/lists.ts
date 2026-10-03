import type { Word, WordList } from './types'

export function createWordLists(words: Word[], size = 50, existingMax = 0,
  language: 'en' | 'de' = 'en', subjectId: string): WordList[] {
  const limit = Math.max(1, Math.min(200, Math.floor(size)))
  const ready = words.filter(word => word.subjectId === subjectId && word.language === language &&
    word.status === 'processed' && !word.listId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const lists: WordList[] = []
  for (let start = 0; start + limit <= ready.length; start += limit) {
    const number = existingMax + lists.length + 1
    lists.push({ id: crypto.randomUUID(), subjectId, language, number,
      wordIds: ready.slice(start, start + limit).map(word => word.id), status: 'new', createdAt: new Date().toISOString() })
  }
  return lists
}

import { describe, expect, it } from 'vitest'
import { createWordLists } from '../src/domain/lists'
import { scoreQuiz } from '../src/domain/quiz'
import { mergeVocabulary, previewVocabularyCsv } from '../src/domain/import'
import type { Word } from '../src/domain/types'

const word = (number: number): Word => ({
  id: String(number), subjectId: 'english', language: 'en', word: `word${number}`,
  meaning: `meaning${number}`, status: 'processed', personalWeak: false, weakHistory: 0,
  difficulty: 3, mastery: 0, errorCount: 0, reviewCount: 0, createdAt: '2026-10-03',
})

describe('vocabulary', () => {
  it('makes numbered 50-word lists and leaves inbox words untouched', () => {
    const words = Array.from({ length: 101 }, (_, i) => word(i))
    words[100].status = 'inbox'
    const lists = createWordLists(words, 50, 7, 'en', 'english')
    expect(lists.map(list => [list.number, list.wordIds.length])).toEqual([[8, 50], [9, 50]])
    expect(lists.flatMap(list => list.wordIds)).not.toContain('100')
  })

  it('scores quiz skills and returns wrong words', () => {
    const result = scoreQuiz([
      { wordId: '1', kind: 'spelling', correct: true },
      { wordId: '2', kind: 'meaning', correct: false },
      { wordId: '3', kind: 'context', correct: true },
      { wordId: '4', kind: 'network', correct: false },
    ])
    expect(result.total).toBe(50)
    expect(result.breakdown.spelling).toBe(100)
    expect(result.wrongWordIds).toEqual(['2', '4'])
  })

  it('previews CSV issues and merges duplicate words according to strategy', () => {
    const csv = 'Word,Meaning,Mnemonic,Example,ExampleCN,DerivedWords,AffixFamily\nability,能力,,,,,\n,missing,,,,,\nnew,新的,,,,,'
    const preview = previewVocabularyCsv(csv, [word(1), { ...word(2), word: 'ability' }])
    expect(preview.valid.length).toBe(2)
    expect(preview.invalid.length).toBe(1)
    expect(preview.duplicates).toContain('ability')
    expect(mergeVocabulary([{ ...word(2), word: 'ability' }], preview.valid, 'skip').length).toBe(2)
    expect(mergeVocabulary([{ ...word(2), word: 'ability' }], preview.valid, 'replace').find(w => w.word === 'ability')?.meaning).toBe('能力')
  })

  it('keeps the same spelling in separate subjects independent', () => {
    const existing = [{ ...word(1), word: 'ability', subjectId: 'english-a' }]
    const incoming = previewVocabularyCsv('Word,Meaning\nability,能力', existing, 'english-b').valid
    expect(mergeVocabulary(existing, incoming, 'skip')).toHaveLength(2)
    expect(incoming[0].subjectId).toBe('english-b')
  })
})

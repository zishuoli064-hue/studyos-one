import type { Word } from './types'

export type DuplicateStrategy = 'skip' | 'merge' | 'replace'
export interface CsvPreview { valid: Word[]; invalid: { row: number; reason: string }[]; duplicates: string[] }

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i++
      row.push(cell); if (row.some(value => value.trim())) rows.push(row)
      row = []; cell = ''
    } else cell += char
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field')
  row.push(cell); if (row.some(value => value.trim())) rows.push(row)
  return rows
}

export function previewVocabularyCsv(csv: string, existing: Word[], subjectId = 'english', language: 'en' | 'de' = 'en'): CsvPreview {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''))
  if (!rows.length) throw new Error('CSV is empty')
  const keys = rows[0].map(value => value.trim().toLowerCase().replace(/[^a-z]/g, ''))
  const index = (name: string) => keys.indexOf(name.toLowerCase())
  if (index('word') < 0) throw new Error('CSV requires a Word column')
  const valid: Word[] = [], invalid: CsvPreview['invalid'] = [], duplicates: string[] = []
  const seen = new Set(existing.filter(word => word.language === language).map(word => word.word.trim().toLocaleLowerCase()))
  for (let i = 1; i < rows.length; i++) {
    const get = (key: string) => (rows[i][index(key)] || '').trim()
    const spelling = get('word')
    if (!spelling) { invalid.push({ row: i + 1, reason: 'Missing Word' }); continue }
    if (seen.has(spelling.toLocaleLowerCase())) duplicates.push(spelling)
    seen.add(spelling.toLocaleLowerCase())
    valid.push({ id: crypto.randomUUID(), subjectId, language, word: spelling, meaning: get('meaning'),
      mnemonic: get('mnemonic'), example: get('example'), exampleCN: get('examplecn'),
      derivedWords: get('derivedwords'), affixFamily: get('affixfamily'), status: 'processed',
      personalWeak: false, weakHistory: 0, difficulty: 3, mastery: 0, errorCount: 0,
      reviewCount: 0, createdAt: new Date().toISOString() })
  }
  return { valid, invalid, duplicates }
}

export function mergeVocabulary(existing: Word[], incoming: Word[], strategy: DuplicateStrategy): Word[] {
  const output = [...existing]
  for (const word of incoming) {
    const index = output.findIndex(current => current.language === word.language &&
      current.word.trim().toLocaleLowerCase() === word.word.trim().toLocaleLowerCase())
    if (index < 0) output.push(word)
    else if (strategy === 'replace') output[index] = { ...word, id: output[index].id }
    else if (strategy === 'merge') {
      const current = output[index]
      output[index] = { ...word, ...current,
        meaning: current.meaning || word.meaning, mnemonic: current.mnemonic || word.mnemonic,
        example: current.example || word.example, exampleCN: current.exampleCN || word.exampleCN,
        derivedWords: current.derivedWords || word.derivedWords, affixFamily: current.affixFamily || word.affixFamily }
    }
  }
  return output
}

export const VOCABULARY_CSV_TEMPLATE = 'Word,Meaning,Mnemonic,Example,ExampleCN,DerivedWords,AffixFamily\nability,能力,able + -ity,She has the ability to learn.,她有学习能力。,able; unable,activity; possibility\n'

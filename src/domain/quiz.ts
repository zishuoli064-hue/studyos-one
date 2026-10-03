import type { QuizKind, Word } from './types'

export interface QuizAnswer { wordId: string; kind: QuizKind; correct: boolean }
export interface QuizQuestion { wordId: string; kind: QuizKind; prompt: string; answer: string; options?: string[] }
const KINDS: QuizKind[] = ['spelling', 'meaning', 'context', 'network']

export function scoreQuiz(answers: QuizAnswer[]) {
  const breakdown = Object.fromEntries(KINDS.map(kind => {
    const subset = answers.filter(answer => answer.kind === kind)
    return [kind, subset.length ? Math.round(subset.filter(answer => answer.correct).length / subset.length * 100) : 0]
  })) as Record<QuizKind, number>
  return {
    total: answers.length ? Math.round(answers.filter(answer => answer.correct).length / answers.length * 100) : 0,
    breakdown,
    wrongWordIds: [...new Set(answers.filter(answer => !answer.correct).map(answer => answer.wordId))],
  }
}

export function buildQuizQuestions(words: Word[]): QuizQuestion[] {
  const spelling = Math.round(words.length * 0.4)
  const meaning = Math.round(words.length * 0.25)
  const context = Math.round(words.length * 0.25)
  const shares: QuizKind[] = words.map((_, index) =>
    index < spelling ? 'spelling' : index < spelling + meaning ? 'meaning' :
      index < spelling + meaning + context ? 'context' : 'network')
  if (words.length >= 4 && !shares.includes('network')) shares[shares.length - 1] = 'network'
  return words.map((word, index) => {
    const kind = shares[index]
    if (kind === 'spelling') return { wordId: word.id, kind, prompt: word.meaning, answer: word.word }
    if (kind === 'meaning') {
      const distractors = words.filter(other => other.id !== word.id && other.meaning !== word.meaning)
        .slice(0, 3).map(other => other.meaning)
      const options = [...new Set([word.meaning, ...distractors])].slice(0, 4)
      return { wordId: word.id, kind, prompt: word.word, answer: word.meaning, options }
    }
    if (kind === 'context') return { wordId: word.id, kind,
      prompt: word.example?.replace(new RegExp(`\\b${word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '_____') || `${word.meaning} → _____`, answer: word.word }
    return { wordId: word.id, kind, prompt: `Word family of ${word.word}`,
      answer: word.derivedWords?.split(/[,;]+/)[0]?.trim() || word.affixFamily?.split(/[,;]+/)[0]?.trim() || word.word }
  })
}

export function checkAnswer(question: QuizQuestion, response: string): boolean {
  return question.answer.trim().toLocaleLowerCase() === response.trim().toLocaleLowerCase()
}

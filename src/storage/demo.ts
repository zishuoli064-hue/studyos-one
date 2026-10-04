import type { Snapshot, AppSettings, Subject, Word, Topic, Mistake, Task, Exam, WordList } from '../domain/types'

const englishWords = [
  ['ability', '能力', 'able + -ity', 'She has the ability to solve difficult problems.', '她有解决难题的能力。', 'able; unable', 'activity; possibility'],
  ['achieve', '实现', 'a + chief → 达到目标', 'You can achieve your goal with practice.', '通过练习你能实现目标。', 'achievement', 'believe; relieve'],
  ['adapt', '适应', 'ad + apt', 'We adapt to a new environment.', '我们适应新环境。', 'adaptation; adaptable', 'adopt'],
  ['approach', '方法；接近', 'ap + proach', 'Try a different approach.', '尝试另一种方法。', 'approachable', 'reproach'],
  ['benefit', '益处', 'bene = good', 'Exercise has many benefits.', '锻炼有很多益处。', 'beneficial', 'benevolent'],
  ['challenge', '挑战', 'challenge yourself', 'The exam is a challenge.', '这场考试是一个挑战。', 'challenging', 'change'],
  ['consider', '考虑', 'con + sider', 'Consider every option.', '考虑每个选项。', 'consideration', 'considerable'],
  ['evidence', '证据', 'e + vid = see', 'There is clear evidence.', '有明确的证据。', 'evident', 'provide'],
  ['improve', '提高', 'im + prove', 'Reading can improve vocabulary.', '阅读可以提高词汇量。', 'improvement', 'prove'],
  ['require', '需要', 're + quire', 'The course requires practice.', '这门课程需要练习。', 'requirement', 'acquire'],
] as const

const germanWords = [
  ['Tisch', '桌子', 'der', 'Tische', 'Der Tisch ist groß.', '桌子很大。'],
  ['Buch', '书', 'das', 'Bücher', 'Das Buch ist interessant.', '这本书很有趣。'],
  ['Haus', '房子', 'das', 'Häuser', 'Das Haus ist neu.', '这所房子是新的。'],
  ['Zeit', '时间', 'die', 'Zeiten', 'Ich habe heute Zeit.', '我今天有时间。'],
  ['gehen', '走', '', '', 'Wir gehen nach Hause.', '我们回家。'],
] as const

function dayFrom(now: Date, days: number): string {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function demoSnapshot(settings: AppSettings, now = new Date()): Snapshot {
  const createdAt = now.toISOString()
  const today = dayFrom(now, 0)
  const subjects: Subject[] = [
    { id: 'demo-english', name: 'CET-4 English', kind: 'english', sortOrder: 0, createdAt },
    { id: 'demo-german', name: 'German A1', kind: 'german', sortOrder: 1, createdAt },
    { id: 'demo-math', name: 'Math Competition', kind: 'math', sortOrder: 2, createdAt },
  ]
  const words: Word[] = [
    ...englishWords.map((entry, index): Word => ({ id: `demo-en-${index + 1}`, subjectId: 'demo-english', language: 'en',
      word: entry[0], meaning: entry[1], mnemonic: entry[2], example: entry[3], exampleCN: entry[4],
      derivedWords: entry[5], affixFamily: entry[6], listId: 'demo-list-en-1', status: 'learning', personalWeak: index < 2,
      weakHistory: index < 2 ? 1 : 0, difficulty: 2 + index % 3, mastery: index < 2 ? 35 : 60,
      errorCount: index < 2 ? 2 : 0, reviewCount: index < 2 ? 1 : 0,
      nextReviewAt: index < 2 ? today : undefined, createdAt })),
    ...germanWords.map((entry, index): Word => ({ id: `demo-de-${index + 1}`, subjectId: 'demo-german', language: 'de',
      word: entry[0], meaning: entry[1], article: entry[2], plural: entry[3], example: entry[4], exampleCN: entry[5],
      listId: 'demo-list-de-1', status: 'learning', personalWeak: false, weakHistory: 0, difficulty: 2, mastery: 50, errorCount: 0,
      reviewCount: 0, createdAt })),
  ]
  const topics: Topic[] = [
    { id: 'demo-topic-1', subjectId: 'demo-math', name: 'Limits', mastery: 45, importance: 5, reviewCount: 1, nextReviewAt: today },
    { id: 'demo-topic-2', subjectId: 'demo-math', name: 'Derivatives', mastery: 65, importance: 4, reviewCount: 0 },
    { id: 'demo-topic-3', subjectId: 'demo-math', name: 'Sequences', mastery: 55, importance: 4, reviewCount: 0 },
  ]
  const mistakes: Mistake[] = [
    { id: 'demo-mistake-1', subjectId: 'demo-math', topic: 'Limits', title: 'Indeterminate form', source: 'Practice set',
      problem: 'Find lim (x²−1)/(x−1) as x→1.', myError: 'Substituted directly and stopped at 0/0.',
      correctMethod: 'Factor x²−1=(x−1)(x+1), then cancel.', keyInsight: 'Simplify before substitution.',
      difficulty: 2, errorType: 'method', createdAt, nextReviewAt: today, mastery: 35, reviewCount: 0, mastered: false },
    { id: 'demo-mistake-2', subjectId: 'demo-math', topic: 'Derivatives', title: 'Chain rule',
      problem: 'Differentiate (2x+1)³.', myError: 'Forgot the inner derivative.',
      correctMethod: '3(2x+1)² × 2.', keyInsight: 'Always differentiate the inner function.',
      difficulty: 2, errorType: 'concept', createdAt, mastery: 55, reviewCount: 0, mastered: false },
  ]
  const tasks: Task[] = [
    { id: 'demo-task-en', subjectId: 'demo-english', title: 'Study CET-4 List 01', description: 'Build a strong word base.',
      quantity: '10 sample words', estimatedMinutes: 35, importance: 5, difficulty: 2, status: 'pending', createdAt },
    { id: 'demo-task-de', subjectId: 'demo-german', title: 'German A1 · Lektion 01', description: 'Learn nouns and examples.',
      quantity: '5 words', estimatedMinutes: 40, importance: 4, difficulty: 2, status: 'pending', createdAt },
    { id: 'demo-task-math', subjectId: 'demo-math', title: 'Limits practice', description: 'Solve five limit problems.',
      quantity: '5 problems', estimatedMinutes: 60, importance: 5, difficulty: 4, mastery: 45,
      deadline: dayFrom(now, 7), status: 'pending', createdAt },
  ]
  const exams: Exam[] = [
    { id: 'demo-exam-en', subjectId: 'demo-english', name: 'CET-4', date: dayFrom(now, 60), importance: 5 },
    { id: 'demo-exam-math', subjectId: 'demo-math', name: 'Math Competition', date: dayFrom(now, 28), importance: 5 },
  ]
  const lists: WordList[] = [
    { id: 'demo-list-en-1', subjectId: 'demo-english', language: 'en', number: 1,
      wordIds: words.filter(word => word.language === 'en').map(word => word.id), status: 'new', createdAt },
    { id: 'demo-list-de-1', subjectId: 'demo-german', language: 'de', number: 1,
      wordIds: words.filter(word => word.language === 'de').map(word => word.id), status: 'new', createdAt },
  ]
  return { subjects, tasks, exams, words, lists, mistakes, topics, sessions: [], quizResults: [], notes: [], plans: [], settings }
}

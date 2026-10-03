import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, Star, Trash2, Pencil, Sparkles } from 'lucide-react'
import type { Subject, Word, WordList, QuizKind } from '../../domain/types'
import { createWordLists } from '../../domain/lists'
import { applyReview } from '../../domain/review'
import { buildQuizQuestions, checkAnswer, scoreQuiz, type QuizAnswer } from '../../domain/quiz'
import { db } from '../../storage/db'
import { useApp } from '../../app/context'
import { confirmDelete, duration } from '../../app/utils'

type View = 'lists' | 'study' | 'quiz' | 'results'

export function VocabularyView({ subject, inbox }: { subject: Subject; inbox: boolean }) {
  const { data, run, notify } = useApp()
  const language = subject.kind === 'german' ? 'de' : 'en'
  const words = data.words.filter(word => word.subjectId === subject.id && word.language === language)
  const lists = data.lists.filter(list => list.subjectId === subject.id).sort((a, b) => a.number - b.number)
  const [view, setView] = useState<View>('lists')
  const [activeList, setActiveList] = useState<WordList | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([])
  const [response, setResponse] = useState('')
  const [startedAt, setStartedAt] = useState(Date.now())
  const [editing, setEditing] = useState<Word | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [showWeak, setShowWeak] = useState(false)
  const [visible, setVisible] = useState(50)
  const [form, setForm] = useState({ word: '', meaning: '', ipa: '', article: '', plural: '', thirdPerson: '', past: '', perfect: '',
    mnemonic: '', example: '', exampleCN: '', derivedWords: '', affixFamily: '', source: '' })
  const activeWords = useMemo(() => activeList?.wordIds.map(id => words.find(word => word.id === id)).filter((word): word is Word => !!word) ?? [], [activeList, words])
  const questions = useMemo(() => buildQuizQuestions(activeWords), [activeWords])
  const current = activeWords[index]
  const question = questions[index]

  const openForm = (word?: Word) => {
    setEditing(word ?? null)
    setForm({ word: word?.word ?? '', meaning: word?.meaning ?? '', ipa: word?.ipa ?? '', article: word?.article ?? '',
      plural: word?.plural ?? '', thirdPerson: word?.thirdPerson ?? '', past: word?.past ?? '', perfect: word?.perfect ?? '',
      mnemonic: word?.mnemonic ?? '', example: word?.example ?? '', exampleCN: word?.exampleCN ?? '',
      derivedWords: word?.derivedWords ?? '', affixFamily: word?.affixFamily ?? '', source: word?.source ?? '' })
    setAddOpen(true)
  }
  const saveWord = () => void run(async () => {
    if (!form.word.trim()) throw new Error('Word is required')
    const duplicate = words.find(word => word.id !== editing?.id && word.word.trim().toLocaleLowerCase() === form.word.trim().toLocaleLowerCase())
    if (duplicate) throw new Error('This word is already in your vocabulary')
    const next: Word = { ...(editing ?? { id: crypto.randomUUID(), subjectId: subject.id, language,
      status: inbox ? 'inbox' : 'processed', personalWeak: false, weakHistory: 0, difficulty: 3,
      mastery: 0, errorCount: 0, reviewCount: 0, createdAt: new Date().toISOString() }),
      ...form, word: form.word.trim(), meaning: form.meaning.trim() }
    await db.words.put(next); setAddOpen(false)
  }, editing ? 'Word updated' : inbox ? 'Saved to Inbox' : 'Word added')
  const generateLists = () => void run(async () => {
    const created = createWordLists(words, data.settings?.wordsPerList ?? 50, Math.max(0, ...lists.map(list => list.number)), language, subject.id)
    if (!created.length) throw new Error(`Add ${Math.max(0, (data.settings?.wordsPerList ?? 50) - words.filter(word => word.status === 'processed' && !word.listId).length)} more processed words to make a list`)
    await db.transaction('rw', db.lists, db.words, async () => {
      await db.lists.bulkAdd(created)
      for (const list of created) await db.words.bulkPut(list.wordIds.map(id => ({ ...words.find(word => word.id === id)!, listId: list.id, status: 'learning' as const })))
    })
  }, 'New list ready')
  const startList = (list: WordList, target: View = 'study') => {
    setActiveList(list); setView(target); setIndex(0); setRevealed(false); setQuizAnswers([]); setResponse(''); setStartedAt(Date.now())
  }
  const rateWord = (rating: 'forgot' | 'good') => current && void run(async () => {
    const result = applyReview({ mastery: current.mastery, errorCount: current.errorCount, reviewCount: current.reviewCount,
      rating, now: new Date().toISOString().slice(0, 10), intervals: data.settings?.reviewIntervals })
    await db.words.put({ ...current, ...result, status: 'learning' })
    if (index + 1 >= activeWords.length) { setIndex(0); setView('quiz') }
    else { setIndex(index + 1); setRevealed(false) }
  })
  const submitAnswer = () => {
    if (!question || !response.trim()) return
    const answer: QuizAnswer = { wordId: question.wordId, kind: question.kind, correct: checkAnswer(question, response) }
    const next = [...quizAnswers, answer]
    setQuizAnswers(next); setResponse('')
    if (index + 1 < questions.length) setIndex(index + 1)
    else void run(async () => {
      const timestamp = new Date().toISOString()
      await db.transaction('rw', db.words, db.lists, db.quizResults, db.sessions, async () => {
        await db.quizResults.bulkAdd(next.map(item => ({ ...item, id: crypto.randomUUID(), listId: activeList!.id, createdAt: timestamp })))
        await db.words.bulkPut(activeWords.map(word => {
          const result = next.find(item => item.wordId === word.id)
          if (!result) return word
          const review = applyReview({ mastery: word.mastery, errorCount: word.errorCount, reviewCount: word.reviewCount,
            rating: result.correct ? 'good' : 'forgot', now: timestamp.slice(0, 10), intervals: data.settings?.reviewIntervals })
          return { ...word, ...review, personalWeak: result.correct ? word.personalWeak : true,
            weakHistory: word.weakHistory + (result.correct ? 0 : 1) }
        }))
        await db.lists.put({ ...activeList!, status: 'done' })
        await db.sessions.add({ id: crypto.randomUUID(), subjectId: subject.id,
          minutes: Math.max(1, Math.round((Date.now() - startedAt) / 60_000)), kind: 'vocabulary', createdAt: timestamp })
      })
      setView('results'); setIndex(0); notify('List complete. Wrong words are in Review.')
    })
  }
  const weakWords = words.filter(word => word.personalWeak)
  const inventory = (showWeak ? weakWords : words.filter(word => !inbox || word.status === 'inbox'))
    .sort((a, b) => a.word.localeCompare(b.word))

  if (view !== 'lists' && !inbox) return <div className="vocab-workflow">
    <button className="text-link" onClick={() => { setView('lists'); setActiveList(null) }}><ArrowLeft size={16}/> All lists</button>
    {view === 'study' && current && <div className="study-card-wrap"><div className="eyebrow">LIST {String(activeList?.number ?? 1).padStart(2, '0')} · WORD {index + 1} / {activeWords.length}</div>
      <div className="word-card"><div className="word-headline">{current.article && <span>{current.article} </span>}{current.word}</div>
        {data.settings?.showIPA && current.ipa && <div className="word-ipa">{current.ipa}</div>}
        {!revealed ? <button className="button-primary reveal-button" onClick={() => setRevealed(true)}>Reveal meaning <ArrowRight size={17}/></button> :
          <div className="word-reveal"><h3>{current.meaning}</h3>{current.mnemonic && <p><strong>Remember</strong> {current.mnemonic}</p>}
            {current.example && <blockquote>{current.example}{data.settings?.showExampleCN && current.exampleCN && <small>{current.exampleCN}</small>}</blockquote>}
            {current.derivedWords && <p><strong>Derived</strong> {current.derivedWords}</p>}
            {current.affixFamily && <p><strong>Word family</strong> {current.affixFamily}</p>}
            {current.plural && <p><strong>Plural</strong> {current.plural}</p>}
            {(current.thirdPerson || current.past || current.perfect) && <p><strong>Forms</strong> {[current.thirdPerson, current.past, current.perfect].filter(Boolean).join(' · ')}</p>}</div>}</div>
      {revealed && <div className="study-actions"><button className="button-quiet" onClick={() => rateWord('forgot')}>Again</button>
        <button className="button-primary" onClick={() => rateWord('good')}>Got it <ArrowRight size={17}/></button></div>}</div>}
    {view === 'quiz' && question && <div className="quiz-card"><div className="eyebrow">LIST QUIZ · {index + 1} / {questions.length}</div>
      <div className="quiz-progress"><span style={{ width: `${index / Math.max(1, questions.length) * 100}%` }}/></div>
      <p className="quiz-kind">{({ spelling: 'Chinese → English', meaning: 'English → Chinese', context: 'In context', network: 'Word network' } as Record<QuizKind, string>)[question.kind]}</p>
      <h2>{question.prompt}</h2>
      {question.options ? <div className="quiz-options">{question.options.map(option => <button key={option}
        className={response === option ? 'selected' : ''} onClick={() => setResponse(option)}>{option}</button>)}</div> :
        <input autoFocus aria-label="Quiz answer" value={response} onChange={event => setResponse(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') submitAnswer() }} placeholder="Type your answer"/>}
      <button className="button-primary" disabled={!response.trim()} onClick={submitAnswer}>Check & continue <ArrowRight size={17}/></button></div>}
    {view === 'results' && <div className="panel quiz-results"><Sparkles size={27}/><div className="eyebrow">LIST COMPLETE</div>
      <h2>{scoreQuiz(quizAnswers).total}%</h2><p>You practised {quizAnswers.length} words. Focus on the ones that need another pass.</p>
      <div className="result-grid">{Object.entries(scoreQuiz(quizAnswers).breakdown).map(([kind, value]) => <div key={kind}><span>{kind}</span><strong>{value}%</strong></div>)}</div>
      <h3>Wrong words</h3><p>{scoreQuiz(quizAnswers).wrongWordIds.map(id => activeWords.find(word => word.id === id)?.word).filter(Boolean).join(' · ') || 'None. Nice work.'}</p>
      <button className="button-primary" onClick={() => { setView('lists'); setActiveList(null) }}>Back to lists</button></div>}
  </div>

  return <section className="stack vocabulary-view"><div className="row between wrap"><div><h3>{inbox ? 'Vocabulary Inbox' : 'Vocabulary'}</h3>
    <p className="muted">{inbox ? 'Capture now, organize later. Inbox words do not enter review yet.' : `${words.length} words · ${lists.length} lists`}</p></div>
    <button className="button-quiet" onClick={() => openForm()}><Plus size={16}/> {inbox ? 'Capture word' : 'Add word'}</button></div>
    {addOpen && <form className="panel compact-form" onSubmit={event => { event.preventDefault(); saveWord() }}><h3>{editing ? 'Edit word' : 'New word'}</h3>
      <div className="field-grid"><label className="field">Word<input autoFocus required value={form.word} onChange={event => setForm({ ...form, word: event.target.value })}/></label>
        <label className="field">Meaning<input value={form.meaning} onChange={event => setForm({ ...form, meaning: event.target.value })}/></label></div>
      <div className="field-grid"><label className="field">{language === 'de' ? 'Article' : 'IPA'}<input value={language === 'de' ? form.article : form.ipa}
        onChange={event => setForm({ ...form, [language === 'de' ? 'article' : 'ipa']: event.target.value })}/></label>
        {language === 'de' && <label className="field">Plural<input value={form.plural} onChange={event => setForm({ ...form, plural: event.target.value })}/></label>}</div>
      {language === 'de' && <div className="field-grid three"><label className="field">Third person<input value={form.thirdPerson} onChange={event => setForm({ ...form, thirdPerson: event.target.value })}/></label>
        <label className="field">Past<input value={form.past} onChange={event => setForm({ ...form, past: event.target.value })}/></label>
        <label className="field">Perfect<input value={form.perfect} onChange={event => setForm({ ...form, perfect: event.target.value })}/></label></div>}
      <details className="optional-fields"><summary>Examples & word family</summary>
        {(['mnemonic', 'example', 'exampleCN', 'derivedWords', 'affixFamily', 'source'] as const).map(key =>
          <label className="field" key={key}>{key.replace(/([A-Z])/g, ' $1')}<input value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })}/></label>)}</details>
      <div className="row wrap"><button className="button-primary" type="submit">Save word</button><button type="button" className="button-quiet" onClick={() => setAddOpen(false)}>Cancel</button></div></form>}
    {!inbox && <><div className="row between wrap"><h4>Your lists</h4><button className="text-link" onClick={generateLists}><Plus size={16}/> Generate next list</button></div>
      <div className="list-grid">{lists.map(list => <div className="panel list-tile" key={list.id}><div className="eyebrow">{subject.name.toUpperCase()}</div>
        <h3>List {String(list.number).padStart(2, '0')}</h3><p>{list.wordIds.length} words · {list.status === 'done' ? 'Completed' : 'Ready to learn'}</p>
        <div className="row wrap"><button className="button-primary" onClick={() => startList(list)}>{list.status === 'done' ? 'Study again' : 'Start list'} <ArrowRight size={16}/></button>
          <button className="button-quiet" onClick={() => startList(list, 'quiz')}>Quiz</button></div></div>)}</div>
      {lists.length === 0 && <div className="empty-state small"><p>Add {data.settings?.wordsPerList ?? 50} processed words to generate List 01.</p></div>}</>}
    <div className="row between wrap"><h4>{inbox ? 'Captured words' : 'Word library'}</h4>{!inbox && <button className="text-link" onClick={() => setShowWeak(!showWeak)}>
      <Star size={16}/> {showWeak ? 'All words' : `Personal weak (${weakWords.length})`}</button>}</div>
    {inventory.length === 0 && <div className="empty-state small"><p>{inbox ? 'Nothing in your Inbox yet.' : 'No words to show.'}</p></div>}
    {inventory.slice(0, visible).map(word => <div className="list-card" key={word.id}><div><strong>{word.article ? `${word.article} ` : ''}{word.word}</strong>
      <small>{word.meaning || 'Meaning to add'} · {word.status}{word.personalWeak ? ' · Personal weak' : ''}</small></div>
      <div className="row wrap">{inbox && <button className="button-quiet" onClick={() => void run(() => db.words.put({ ...word, status: 'processed' }), 'Ready for a list')}>Process</button>}
        <button className={`icon-button ${word.personalWeak ? 'starred' : ''}`} aria-label={`Mark ${word.word} as weak`}
          onClick={() => void run(() => db.words.put({ ...word, personalWeak: !word.personalWeak,
            weakHistory: word.weakHistory + (word.personalWeak ? 0 : 1) }))}><Star size={17}/></button>
        <button className="icon-button" aria-label={`Edit ${word.word}`} onClick={() => openForm(word)}><Pencil size={16}/></button>
        <button className="icon-button danger" aria-label={`Delete ${word.word}`} onClick={() => confirmDelete(word.word) && void run(() => db.words.delete(word.id), 'Word deleted')}><Trash2 size={16}/></button></div></div>)}
    {visible < inventory.length && <button className="button-quiet" onClick={() => setVisible(visible + 50)}>Load more ({inventory.length - visible} remaining)</button>}
    {!inbox && <p className="muted">Default list size: {data.settings?.wordsPerList ?? 50} words · Estimated {duration(Math.ceil((data.settings?.wordsPerList ?? 50) * 0.7))} per list</p>}
  </section>
}

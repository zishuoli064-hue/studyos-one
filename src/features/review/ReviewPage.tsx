import { useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import type { Mistake, Rating, Topic, Word } from '../../domain/types'
import { applyReview, dueForReview } from '../../domain/review'
import { db } from '../../storage/db'
import { useApp } from '../../app/context'
import { localDay } from '../../app/utils'

type ReviewItem = { id: string; type: 'word'; value: Word } | { id: string; type: 'mistake'; value: Mistake } | { id: string; type: 'topic'; value: Topic }
const RATINGS: { id: Rating; hint: string }[] = [
  { id: 'forgot', hint: 'Again soon' }, { id: 'hard', hint: 'Short interval' },
  { id: 'good', hint: 'On track' }, { id: 'easy', hint: 'Space it out' },
]

export function ReviewPage() {
  const { data, run } = useApp()
  const today = localDay()
  const [selected, setSelected] = useState<ReviewItem | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [minutes, setMinutes] = useState(5)
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<'due' | 'future'>('due')
  const items: ReviewItem[] = [
    ...data.words.filter(word => word.status === 'learning').map(word => ({ id: word.id, type: 'word' as const, value: word })),
    ...data.mistakes.filter(mistake => !mistake.mastered).map(mistake => ({ id: mistake.id, type: 'mistake' as const, value: mistake })),
    ...data.topics.map(topic => ({ id: topic.id, type: 'topic' as const, value: topic })),
  ]
  const dateOf = (item: ReviewItem) => item.value.nextReviewAt
  const due = items.filter(item => dueForReview(dateOf(item), today))
  const future = items.filter(item => !dueForReview(dateOf(item), today))
  const overdue = due.filter(item => dateOf(item) && dateOf(item)! < today)
  const list = filter === 'due' ? due : future
  const subjectOf = (item: ReviewItem) => data.subjects.find(subject => subject.id === item.value.subjectId)?.name ?? 'Subject'
  const titleOf = (item: ReviewItem) => item.type === 'word' ? `${item.value.article ? `${item.value.article} ` : ''}${item.value.word}` :
    item.type === 'mistake' ? item.value.title : item.value.name
  const select = (item: ReviewItem) => { setSelected(item); setRevealed(false); setMinutes(data.settings?.defaultTimer ? 10 : 5); setNote('') }
  const rate = (rating: Rating) => selected && void run(async () => {
    const value = selected.value
    const review = applyReview({ mastery: value.mastery,
      errorCount: selected.type === 'word' ? selected.value.errorCount : selected.type === 'mistake' ? selected.value.mastered ? 0 : 1 : 0,
      reviewCount: value.reviewCount, rating, now: today, intervals: data.settings?.reviewIntervals })
    const createdAt = new Date().toISOString()
    await db.transaction('rw', db.words, db.mistakes, db.topics, db.sessions, db.notes, async () => {
      if (selected.type === 'word') await db.words.put({ ...selected.value, ...review,
        personalWeak: rating === 'forgot' ? true : selected.value.personalWeak,
        weakHistory: selected.value.weakHistory + (rating === 'forgot' ? 1 : 0) })
      if (selected.type === 'mistake') await db.mistakes.put({ ...selected.value, ...review,
        mastered: rating === 'easy' && review.mastery >= 85 })
      if (selected.type === 'topic') await db.topics.put({ ...selected.value, ...review })
      await db.sessions.add({ id: crypto.randomUUID(), subjectId: value.subjectId, minutes: Math.max(1, Math.min(240, minutes)),
        kind: selected.type === 'mistake' ? 'mistake' : 'review', createdAt })
      if (note.trim()) await db.notes.add({ id: crypto.randomUUID(), text: `${titleOf(selected)}: ${note.trim()}`, createdAt })
    })
    setSelected(null)
  }, 'Review saved')

  return <div className="review-page"><div className="page-intro"><div className="eyebrow">KEEP WHAT YOU LEARN</div>
    <h1>Review.</h1><p>Short, focused returns beat starting over.</p></div>
    <div className="stat-grid three"><div className="stat-card"><span>Due now</span><strong>{due.length}</strong></div>
      <div className="stat-card"><span>Overdue</span><strong>{overdue.length}</strong></div>
      <div className="stat-card"><span>Coming up</span><strong>{future.length}</strong></div></div>
    {selected ? <div className="review-workflow"><button className="text-link" onClick={() => setSelected(null)}><ArrowLeft size={16}/> Back to queue</button>
      <div className="panel review-card"><div className="eyebrow">{selected.type.toUpperCase()} · {subjectOf(selected)}</div>
        <h2>{titleOf(selected)}</h2>
        {selected.type === 'word' && <p>{selected.value.example || 'Think of the meaning before revealing it.'}</p>}
        {selected.type === 'mistake' && <p>{selected.value.problem}</p>}
        {selected.type === 'topic' && <p>Explain this topic to yourself in one or two sentences.</p>}
        {!revealed ? <button className="button-primary" onClick={() => setRevealed(true)}>Reveal answer <ArrowRight size={16}/></button> :
          <div className="review-answer">{selected.type === 'word' && <><h3>{selected.value.meaning}</h3><p>{selected.value.mnemonic}</p>
            <p>{selected.value.exampleCN}</p>{selected.value.derivedWords && <p>Derived: {selected.value.derivedWords}</p>}</>}
            {selected.type === 'mistake' && <><h3>Correct method</h3><p>{selected.value.correctMethod || 'Work through this problem again.'}</p>
              <p><strong>Key insight:</strong> {selected.value.keyInsight}</p>{selected.value.imageData && <img className="mistake-image" src={selected.value.imageData} alt="Review problem"/>}</>}
            {selected.type === 'topic' && <p>How well can you recall the key idea?</p>}</div>}</div>
      {revealed && <div className="review-feedback"><div className="field-grid"><label className="field">Minutes spent<input type="number" min={1} max={240} value={minutes}
        onChange={event => setMinutes(Math.max(1, Math.min(240, Number(event.target.value) || 1)))}/></label>
        <label className="field">Note (optional)<input value={note} onChange={event => setNote(event.target.value)} placeholder="What did you miss?"/></label></div>
        <div className="rating-grid">{RATINGS.map(item => <button key={item.id} onClick={() => rate(item.id)}>
          <strong>{item.id[0].toUpperCase() + item.id.slice(1)}</strong><small>{item.hint}</small></button>)}</div></div>}</div> :
      <section className="section"><div className="section-head"><div><div className="eyebrow">SPACED RECALL</div><h2>Review queue</h2></div>
        <div className="segmented"><button className={filter === 'due' ? 'active' : ''} onClick={() => setFilter('due')}>Due</button>
          <button className={filter === 'future' ? 'active' : ''} onClick={() => setFilter('future')}>Future</button></div></div>
        {list.length === 0 && <div className="empty-state"><RotateCcw size={23}/><h3>{filter === 'due' ? 'All caught up.' : 'Nothing scheduled yet.'}</h3>
          <p>{filter === 'due' ? 'Your next review will appear when it is useful.' : 'Study a list or add a topic to start your review cycle.'}</p></div>}
        <div className="review-list">{list.sort((a, b) => (dateOf(a) ?? '').localeCompare(dateOf(b) ?? '')).slice(0, 100).map(item =>
          <button className="review-row" key={`${item.type}-${item.id}`} onClick={() => select(item)}><span className="review-type">{item.type}</span>
            <span className="review-title"><strong>{titleOf(item)}</strong><small>{subjectOf(item)} · Mastery {item.value.mastery}%
              {dateOf(item) ? ` · ${dateOf(item)}` : ''}</small></span><ArrowRight size={18}/></button>)}</div>
        {list.length > 100 && <p className="muted">Showing the first 100 reviews. Finish some to see the rest.</p>}</section>}
  </div>
}

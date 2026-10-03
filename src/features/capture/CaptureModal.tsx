import { useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../app/context'
import { db } from '../../storage/db'
import type { Mistake, Word } from '../../domain/types'

type CaptureKind = 'task' | 'word' | 'mistake' | 'note'

export function CaptureModal({ onClose }: { onClose: () => void }) {
  const { data, run } = useApp()
  const [kind, setKind] = useState<CaptureKind>('task')
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [meaning, setMeaning] = useState('')
  const [minutes, setMinutes] = useState(30)
  const subject = data.subjects.find(item => item.id === subjectId)
  const allowedSubjects = kind === 'word' ? data.subjects.filter(item => item.kind === 'english' || item.kind === 'german') : data.subjects
  const effectiveSubject = allowedSubjects.find(item => item.id === subjectId) ?? allowedSubjects[0]
  const save = () => void run(async () => {
    const name = title.trim(), now = new Date().toISOString()
    if (!name) throw new Error('Enter a title first')
    if (kind !== 'note' && !effectiveSubject) throw new Error('Add a subject in Learn first')
    if (kind === 'task') {
      if (minutes < 15 || minutes > 600) throw new Error('Study time must be 15–600 minutes')
      await db.tasks.add({ id: crypto.randomUUID(), subjectId: effectiveSubject.id, title: name,
        description: detail.trim(), quantity: '', estimatedMinutes: minutes, importance: 3,
        difficulty: 3, status: 'pending', createdAt: now })
    } else if (kind === 'word') {
      const duplicate = data.words.some(word => word.subjectId === effectiveSubject.id && word.word.toLocaleLowerCase() === name.toLocaleLowerCase())
      if (duplicate) throw new Error('This word already exists in the subject')
      const word: Word = { id: crypto.randomUUID(), subjectId: effectiveSubject.id,
        language: effectiveSubject.kind === 'german' ? 'de' : 'en', word: name, meaning: meaning.trim(),
        note: detail.trim(), status: 'inbox', personalWeak: false, weakHistory: 0,
        difficulty: 3, mastery: 0, errorCount: 0, reviewCount: 0, createdAt: now }
      await db.words.add(word)
    } else if (kind === 'mistake') {
      const mistake: Mistake = { id: crypto.randomUUID(), subjectId: effectiveSubject.id, topic: '',
        title: name, problem: detail.trim(), myError: '', correctMethod: '', keyInsight: '',
        difficulty: 3, errorType: 'unknown', createdAt: now, mastery: 0, reviewCount: 0,
        mastered: false, nextReviewAt: now.slice(0, 10) }
      await db.mistakes.add(mistake)
    } else await db.notes.add({ id: crypto.randomUUID(), text: `${name}${detail.trim() ? `\n${detail.trim()}` : ''}`, createdAt: now })
    onClose()
  }, `${kind[0].toUpperCase() + kind.slice(1)} saved`)
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="capture-modal" role="dialog" aria-modal="true" aria-labelledby="capture-title"><div className="row between"><div><div className="eyebrow">SAVE THE THOUGHT</div><h2 id="capture-title">Quick capture</h2></div>
      <button className="icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button></div>
      <div className="segmented capture-kinds" role="tablist" aria-label="Capture type">{(['task','word','mistake','note'] as const).map(option => <button type="button" key={option}
        className={kind === option ? 'active' : ''} aria-selected={kind === option} role="tab" onClick={() => setKind(option)}>{option}</button>)}</div>
      <form onSubmit={event => { event.preventDefault(); save() }} className="stack">
        {kind !== 'note' && <label className="field">Subject<select value={effectiveSubject?.id ?? ''} onChange={event => setSubjectId(event.target.value)}>
          {allowedSubjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="field">{kind === 'word' ? 'Word' : kind === 'mistake' ? 'Mistake title' : kind === 'note' ? 'Note title' : 'Task'}
          <input autoFocus required maxLength={150} value={title} onChange={event => setTitle(event.target.value)}
            placeholder={kind === 'word' ? 'e.g. deliberate' : kind === 'task' ? 'One clear next step' : ''}/></label>
        {kind === 'word' && <label className="field">Meaning<input value={meaning} onChange={event => setMeaning(event.target.value)} maxLength={300}/></label>}
        {kind === 'task' && <label className="field">Estimated minutes<input type="number" min="15" max="600" value={minutes} onChange={event => setMinutes(Number(event.target.value))}/></label>}
        <label className="field">{kind === 'mistake' ? 'Problem or context' : 'Details (optional)'}<textarea value={detail} onChange={event => setDetail(event.target.value)} rows={3}/></label>
        {subject && kind === 'word' && subject.id !== effectiveSubject?.id && <p className="quiet-note">Saved to {effectiveSubject?.name}.</p>}
        <div className="row wrap"><button className="button-primary" type="submit">Save {kind}</button><button className="button-quiet" type="button" onClick={onClose}>Cancel</button></div>
      </form></div></div>
}

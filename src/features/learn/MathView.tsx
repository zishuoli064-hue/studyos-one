import { useState } from 'react'
import { Plus, Pencil, Trash2, ImagePlus } from 'lucide-react'
import type { Mistake, Subject, Topic } from '../../domain/types'
import { db } from '../../storage/db'
import { useApp } from '../../app/context'
import { confirmDelete, localDay } from '../../app/utils'

const ERROR_TYPES: Mistake['errorType'][] = ['concept', 'calculation', 'method', 'careless', 'unknown']

export function MathView({ subject, view }: { subject: Subject; view: 'topics' | 'mistakes' }) {
  const { data, run } = useApp()
  const topics = data.topics.filter(topic => topic.subjectId === subject.id)
  const mistakes = data.mistakes.filter(mistake => mistake.subjectId === subject.id)
  const [open, setOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
  const [editingMistake, setEditingMistake] = useState<Mistake | null>(null)
  const [name, setName] = useState(''), [mastery, setMastery] = useState(50), [importance, setImportance] = useState(3)
  const [form, setForm] = useState({ title: '', topic: '', source: '', problem: '', myError: '', correctMethod: '',
    keyInsight: '', difficulty: 3, errorType: 'unknown' as Mistake['errorType'], imageData: '' })
  const beginTopic = (topic?: Topic) => { setEditingTopic(topic ?? null); setName(topic?.name ?? ''); setMastery(topic?.mastery ?? 50)
    setImportance(topic?.importance ?? 3); setOpen(true) }
  const beginMistake = (mistake?: Mistake) => { setEditingMistake(mistake ?? null); setForm({ title: mistake?.title ?? '',
    topic: mistake?.topic ?? '', source: mistake?.source ?? '', problem: mistake?.problem ?? '', myError: mistake?.myError ?? '',
    correctMethod: mistake?.correctMethod ?? '', keyInsight: mistake?.keyInsight ?? '', difficulty: mistake?.difficulty ?? 3,
    errorType: mistake?.errorType ?? 'unknown', imageData: mistake?.imageData ?? '' }); setOpen(true) }
  const saveTopic = () => void run(async () => {
    if (!name.trim()) throw new Error('Topic name is required')
    await db.topics.put({ id: editingTopic?.id ?? crypto.randomUUID(), subjectId: subject.id, name: name.trim(), mastery,
      importance, reviewCount: editingTopic?.reviewCount ?? 0, nextReviewAt: editingTopic?.nextReviewAt ?? localDay(),
      lastReviewedAt: editingTopic?.lastReviewedAt })
    setOpen(false)
  }, editingTopic ? 'Topic updated' : 'Topic added')
  const saveMistake = () => void run(async () => {
    if (!form.title.trim() || !form.problem.trim()) throw new Error('Title and problem are required')
    await db.mistakes.put({ ...(editingMistake ?? { id: crypto.randomUUID(), subjectId: subject.id, createdAt: new Date().toISOString(),
      nextReviewAt: localDay(), mastery: 35, reviewCount: 0, mastered: false }), ...form, title: form.title.trim() })
    setOpen(false)
  }, editingMistake ? 'Mistake updated' : 'Mistake saved for review')
  const attach = async (file?: File) => {
    if (!file) return
    if (file.size > 2_000_000 || !file.type.startsWith('image/')) { alert('Choose an image smaller than 2 MB'); return }
    const imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file)
    })
    setForm(previous => ({ ...previous, imageData }))
  }
  return <section className="stack"><div className="row between wrap"><div><h3>{view === 'topics' ? 'Knowledge topics' : 'Mistakes'}</h3>
    <p className="muted">{view === 'topics' ? 'Keep track of what you understand.' : 'Turn errors into the next useful review.'}</p></div>
    <button className="button-quiet" onClick={() => view === 'topics' ? beginTopic() : beginMistake()}><Plus size={16}/> Add {view === 'topics' ? 'topic' : 'mistake'}</button></div>
    {open && view === 'topics' && <form className="panel compact-form" onSubmit={event => { event.preventDefault(); saveTopic() }}>
      <h3>{editingTopic ? 'Edit topic' : 'New topic'}</h3><label className="field">Name<input autoFocus required value={name} onChange={event => setName(event.target.value)}/></label>
      <div className="field-grid"><label className="field">Mastery {mastery}%<input type="range" min={0} max={100} value={mastery} onChange={event => setMastery(Number(event.target.value))}/></label>
        <label className="field">Importance<select value={importance} onChange={event => setImportance(Number(event.target.value))}>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label></div>
      <div className="row wrap"><button className="button-primary" type="submit">Save topic</button><button className="button-quiet" type="button" onClick={() => setOpen(false)}>Cancel</button></div></form>}
    {open && view === 'mistakes' && <form className="panel compact-form" onSubmit={event => { event.preventDefault(); saveMistake() }}>
      <h3>{editingMistake ? 'Edit mistake' : 'New mistake'}</h3><div className="field-grid"><label className="field">Title<input autoFocus required value={form.title}
        onChange={event => setForm({ ...form, title: event.target.value })}/></label>
        <label className="field">Topic<input value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })}/></label></div>
      <label className="field">Problem<textarea required value={form.problem} onChange={event => setForm({ ...form, problem: event.target.value })}/></label>
      <div className="field-grid"><label className="field">My error<textarea value={form.myError} onChange={event => setForm({ ...form, myError: event.target.value })}/></label>
        <label className="field">Correct method<textarea value={form.correctMethod} onChange={event => setForm({ ...form, correctMethod: event.target.value })}/></label></div>
      <label className="field">Key insight<input value={form.keyInsight} onChange={event => setForm({ ...form, keyInsight: event.target.value })}/></label>
      <div className="field-grid three"><label className="field">Error type<select value={form.errorType} onChange={event => setForm({ ...form, errorType: event.target.value as Mistake['errorType'] })}>
        {ERROR_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <label className="field">Difficulty<select value={form.difficulty} onChange={event => setForm({ ...form, difficulty: Number(event.target.value) })}>
          {[1,2,3,4,5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>
        <label className="field">Source<input value={form.source} onChange={event => setForm({ ...form, source: event.target.value })}/></label></div>
      <label className="file-button"><ImagePlus size={17}/> {form.imageData ? 'Replace image' : 'Attach image'}<input type="file" accept="image/*" onChange={event => void attach(event.target.files?.[0])}/></label>
      {form.imageData && <img className="mistake-image preview" src={form.imageData} alt="Attached problem"/>}
      <div className="row wrap"><button className="button-primary" type="submit">Save mistake</button><button className="button-quiet" type="button" onClick={() => setOpen(false)}>Cancel</button></div></form>}
    {view === 'topics' && <>{topics.length === 0 && <div className="empty-state small"><p>No topics yet.</p></div>}
      {topics.map(topic => <div className="list-card" key={topic.id}><div><strong>{topic.name}</strong><small>Mastery {topic.mastery}% · Importance {topic.importance}/5{topic.nextReviewAt ? ` · Review ${topic.nextReviewAt}` : ''}</small></div>
        <div className="row"><button className="icon-button" aria-label={`Edit ${topic.name}`} onClick={() => beginTopic(topic)}><Pencil size={16}/></button>
          <button className="icon-button danger" aria-label={`Delete ${topic.name}`} onClick={() => confirmDelete(topic.name) && void run(() => db.topics.delete(topic.id), 'Topic deleted')}><Trash2 size={16}/></button></div></div>)}</>}
    {view === 'mistakes' && <>{mistakes.length === 0 && <div className="empty-state small"><p>No mistakes yet. Capture one when you need to revisit it.</p></div>}
      {mistakes.map(mistake => <div className="panel mistake-card" key={mistake.id}><div className="row between wrap"><span className="eyebrow">{mistake.errorType.toUpperCase()} · {mistake.topic || 'GENERAL'}</span>
        <div className="row"><button className="icon-button" aria-label={`Edit ${mistake.title}`} onClick={() => beginMistake(mistake)}><Pencil size={16}/></button>
          <button className="icon-button danger" aria-label={`Delete ${mistake.title}`} onClick={() => confirmDelete(mistake.title) && void run(() => db.mistakes.delete(mistake.id), 'Mistake deleted')}><Trash2 size={16}/></button></div></div>
        <h4>{mistake.title}</h4><p>{mistake.problem}</p>{mistake.imageData && <img className="mistake-image" src={mistake.imageData} alt={`Problem for ${mistake.title}`}/>}
        <small>Next review: {mistake.nextReviewAt ?? 'Now'} · {mistake.mastered ? 'Mastered' : 'Learning'}</small></div>)}</>}
  </section>
}

import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Plus, Trash2, Pencil, Undo2 } from 'lucide-react'
import type { Exam, Snapshot, Subject, SubjectKind, Task } from '../../domain/types'
import { db } from '../../storage/db'
import { deleteSubject, restoreSubject } from '../../storage/actions'
import { useApp } from '../../app/context'
import { confirmDelete, duration } from '../../app/utils'
import { VocabularyView } from './VocabularyView'
import { MathView } from './MathView'

type Tab = 'overview' | 'vocabulary' | 'inbox' | 'topics' | 'mistakes' | 'tasks' | 'exams'
const SUBJECT_KINDS: SubjectKind[] = ['english', 'german', 'math', 'course', 'project', 'custom']

export function LearnPage() {
  const { data, run, startFocus } = useApp()
  const subjects = [...data.subjects].sort((a, b) => a.sortOrder - b.sortOrder)
  const [selectedId, setSelectedId] = useState<string | null>(subjects[0]?.id ?? null)
  const [tab, setTab] = useState<Tab>('overview')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SubjectKind>('custom')
  const [undo, setUndo] = useState<Partial<Snapshot> | null>(null)
  const selected = subjects.find(subject => subject.id === selectedId) ?? subjects[0]
  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id) }, [selected, selectedId])
  const select = (subject: Subject) => { setSelectedId(subject.id); setTab('overview'); setEditing(false) }
  const addSubject = () => void run(async () => {
    const title = name.trim()
    if (!title) throw new Error('Enter a subject name')
    if (subjects.some(subject => subject.name.toLocaleLowerCase() === title.toLocaleLowerCase())) throw new Error('Subject already exists')
    const id = crypto.randomUUID()
    await db.subjects.add({ id, name: title, kind, sortOrder: subjects.length, createdAt: new Date().toISOString() })
    setSelectedId(id); setShowNew(false); setName(''); setTab('overview')
  }, 'Subject added')
  const saveSubject = () => selected && void run(async () => {
    if (!name.trim()) throw new Error('Enter a subject name')
    await db.subjects.put({ ...selected, name: name.trim(), kind })
    setEditing(false)
  }, 'Subject updated')
  const removeSubject = () => selected && confirmDelete(`${selected.name} and its tasks, words, mistakes and study logs`) &&
    void run(async () => { setUndo(await deleteSubject(db, selected.id)); setSelectedId(null); setTab('overview') }, 'Subject deleted. Undo is available below.')
  const reorderSubject = (subject: Subject, direction: number) => void run(async () => {
    const index = subjects.findIndex(item => item.id === subject.id), other = subjects[index + direction]
    if (!other) return
    await db.subjects.bulkPut([{ ...subject, sortOrder: other.sortOrder }, { ...other, sortOrder: subject.sortOrder }])
  })
  const availableTabs: { id: Tab; label: string }[] = selected ? [
    { id: 'overview', label: 'Overview' },
    ...(selected.kind === 'english' || selected.kind === 'german' ? [{ id: 'vocabulary' as Tab, label: 'Vocabulary' }, { id: 'inbox' as Tab, label: 'Inbox' }] : []),
    ...(selected.kind === 'math' || selected.kind === 'course' ? [{ id: 'topics' as Tab, label: 'Topics' }, { id: 'mistakes' as Tab, label: 'Mistakes' }] : []),
    { id: 'tasks', label: 'Tasks' }, { id: 'exams', label: 'Exams' },
  ] : []
  return <div className="learn-page"><div className="page-intro"><div className="eyebrow">YOUR LEARNING SPACE</div>
    <h1>Learn.</h1><p>Pick up where you left off. Nothing here depends on a streak.</p></div>
    <div className="learn-layout"><aside className="subject-rail"><div className="row between"><h2>Subjects</h2>
      <button className="icon-button" aria-label="Add subject" onClick={() => { setName(''); setKind('custom'); setShowNew(true) }}><Plus size={18}/></button></div>
      <div className="subject-list">{subjects.map(subject => <button key={subject.id} className={subject.id === selected?.id ? 'selected' : ''}
        onClick={() => select(subject)}><span className={`subject-dot kind-${subject.kind}`}/>{subject.name}<ArrowRight size={15}/></button>)}</div>
      <button className="text-link" onClick={() => { setName(''); setKind('custom'); setShowNew(true) }}><Plus size={16}/> New subject</button></aside>
      <div className="learn-content">
        {showNew && <form className="panel compact-form" onSubmit={event => { event.preventDefault(); addSubject() }}>
          <h3>New subject</h3><div className="field-grid"><label className="field">Name<input autoFocus maxLength={100} value={name}
            onChange={event => setName(event.target.value)} required placeholder="e.g. Physics"/></label>
            <label className="field">Type<select value={kind} onChange={event => setKind(event.target.value as SubjectKind)}>
              {SUBJECT_KINDS.map(option => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</select></label></div>
          <div className="row wrap"><button className="button-primary" type="submit">Add subject</button>
            <button className="button-quiet" type="button" onClick={() => setShowNew(false)}>Cancel</button></div></form>}
        {!selected && !showNew && <div className="empty-state"><BookOpen size={24}/><h2>Your space is ready.</h2>
          <p>Add a subject to start planning and tracking your study.</p><button onClick={() => setShowNew(true)}>Add subject</button></div>}
        {selected && <><div className="subject-heading"><div><span className="subject-type">{selected.kind.toUpperCase()}</span>
          <h2>{selected.name}</h2></div><button className="icon-button" aria-label="Edit subject"
            onClick={() => { setName(selected.name); setKind(selected.kind); setEditing(true) }}><Pencil size={17}/></button></div>
          {editing && <form className="panel compact-form" onSubmit={event => { event.preventDefault(); saveSubject() }}>
            <div className="field-grid"><label className="field">Name<input value={name} maxLength={100} required onChange={event => setName(event.target.value)}/></label>
              <label className="field">Type<select value={kind} onChange={event => setKind(event.target.value as SubjectKind)}>
                {SUBJECT_KINDS.map(option => <option key={option} value={option}>{option}</option>)}</select></label></div>
            <div className="row wrap"><button className="button-primary" type="submit">Save changes</button>
              <button className="button-quiet" type="button" onClick={() => setEditing(false)}>Cancel</button>
              <button className="button-danger" type="button" onClick={removeSubject}><Trash2 size={16}/> Delete subject</button></div></form>}
          <div className="tabs" role="tablist" aria-label="Subject sections">{availableTabs.map(item => <button key={item.id} role="tab"
            aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
          {tab === 'overview' && <Overview subject={selected} data={data} onTab={setTab}/ >}
          {(tab === 'vocabulary' || tab === 'inbox') && <VocabularyView subject={selected} inbox={tab === 'inbox'}/>}
          {(tab === 'topics' || tab === 'mistakes') && <MathView subject={selected} view={tab}/>}
          {tab === 'tasks' && <TaskPanel subject={selected} tasks={data.tasks.filter(task => task.subjectId === selected.id)} onStart={startFocus}/>}
          {tab === 'exams' && <ExamPanel subject={selected} exams={data.exams.filter(exam => exam.subjectId === selected.id)}/>}
          <div className="subject-footer"><button className="text-link" onClick={() => reorderSubject(selected, -1)}>Move up</button>
            <button className="text-link" onClick={() => reorderSubject(selected, 1)}>Move down</button></div>
        </>}
        {undo && <div className="undo-bar">Subject removed <button onClick={() => void run(async () => { await restoreSubject(db, undo); setSelectedId(undo.subjects?.[0]?.id ?? null); setUndo(null) }, 'Restored')}><Undo2 size={16}/> Undo</button></div>}
      </div></div>
  </div>
}

function Overview({ subject, data, onTab }: { subject: Subject; data: Snapshot; onTab: (tab: Tab) => void }) {
  const tasks = data.tasks.filter(task => task.subjectId === subject.id)
  const minutes = data.sessions.filter(session => session.subjectId === subject.id).reduce((sum, session) => sum + session.minutes, 0)
  const words = data.words.filter(word => word.subjectId === subject.id)
  const mistakes = data.mistakes.filter(mistake => mistake.subjectId === subject.id)
  return <div className="overview-content"><div className="stat-grid three"><div className="stat-card"><span>Study time</span><strong>{duration(minutes)}</strong></div>
    <div className="stat-card"><span>Open tasks</span><strong>{tasks.filter(task => task.status !== 'done').length}</strong></div>
    <div className="stat-card"><span>{subject.kind === 'math' ? 'Mistakes' : 'Words'}</span><strong>{subject.kind === 'math' ? mistakes.length : words.length}</strong></div></div>
    <div className="panel"><div className="eyebrow">NEXT ACTION</div><h3>{tasks.find(task => task.status !== 'done')?.title ?? 'Make your next step small.'}</h3>
      <p>{tasks.find(task => task.status !== 'done') ? 'Ready when you are.' : 'Add a task and it will appear on Today.'}</p>
      <button className="text-link" onClick={() => onTab('tasks')}>Open tasks <ArrowRight size={16}/></button></div>
    {(subject.kind === 'english' || subject.kind === 'german') && <div className="panel"><div className="eyebrow">VOCABULARY</div>
      <h3>{data.lists.filter(list => list.subjectId === subject.id).length} lists in progress</h3>
      <button className="text-link" onClick={() => onTab('vocabulary')}>Study words <ArrowRight size={16}/></button></div>}</div>
}

function TaskPanel({ subject, tasks, onStart }: { subject: Subject; tasks: Task[]; onStart: (task: Task) => void }) {
  const { run } = useApp()
  const [editing, setEditing] = useState<Task | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(''), [minutes, setMinutes] = useState(40), [importance, setImportance] = useState(3)
  const [deadline, setDeadline] = useState(''), [quantity, setQuantity] = useState(''), [description, setDescription] = useState('')
  const begin = (task?: Task) => { setEditing(task ?? null); setTitle(task?.title ?? ''); setMinutes(task?.estimatedMinutes ?? 40)
    setImportance(task?.importance ?? 3); setDeadline(task?.deadline ?? ''); setQuantity(task?.quantity ?? ''); setDescription(task?.description ?? ''); setOpen(true) }
  const save = () => void run(async () => {
    if (!title.trim()) throw new Error('Task name is required')
    if (minutes < 15 || minutes > 600) throw new Error('Study time must be 15–600 minutes')
    await db.tasks.put({ ...(editing ?? { id: crypto.randomUUID(), subjectId: subject.id, status: 'pending' as const,
      createdAt: new Date().toISOString(), difficulty: 3 }), title: title.trim(), description: description.trim(),
      quantity: quantity.trim(), estimatedMinutes: minutes, importance, deadline: deadline || undefined })
    setOpen(false)
  }, editing ? 'Task updated' : 'Task added')
  return <section className="stack"><div className="row between"><h3>Tasks</h3><button className="button-quiet" onClick={() => begin()}><Plus size={16}/> New task</button></div>
    {open && <form className="panel compact-form" onSubmit={event => { event.preventDefault(); save() }}><h3>{editing ? 'Edit task' : 'New task'}</h3>
      <label className="field">Task name<input autoFocus required maxLength={140} value={title} onChange={event => setTitle(event.target.value)}/></label>
      <div className="field-grid"><label className="field">Quantity / scope<input value={quantity} maxLength={80} onChange={event => setQuantity(event.target.value)} placeholder="e.g. 50 words"/></label>
        <label className="field">Minutes<input type="number" min={15} max={600} value={minutes} onChange={event => setMinutes(Number(event.target.value))}/></label></div>
      <div className="field-grid"><label className="field">Importance<select value={importance} onChange={event => setImportance(Number(event.target.value))}>
        {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>
        <label className="field">Deadline (optional)<input type="date" value={deadline} onChange={event => setDeadline(event.target.value)}/></label></div>
      <label className="field">Notes<textarea value={description} onChange={event => setDescription(event.target.value)}/></label>
      <div className="row wrap"><button className="button-primary" type="submit">Save task</button><button className="button-quiet" type="button" onClick={() => setOpen(false)}>Cancel</button></div></form>}
    {tasks.length === 0 && <div className="empty-state small"><p>No tasks yet. Add one small next step.</p></div>}
    {tasks.map(task => <div className="list-card" key={task.id}><div><div className="row wrap"><strong>{task.title}</strong><span className="status-pill">{task.status}</span></div>
      <small>{task.quantity || task.description || 'Learning task'} · {duration(task.estimatedMinutes)}{task.deadline ? ` · Due ${task.deadline}` : ''}</small></div>
      <div className="row wrap"><button className="button-quiet" onClick={() => onStart(task)}>Start</button>
        <button className="icon-button" aria-label={`Edit ${task.title}`} onClick={() => begin(task)}><Pencil size={16}/></button>
        <button className="icon-button danger" aria-label={`Delete ${task.title}`} onClick={() => confirmDelete(task.title) && void run(() => db.tasks.delete(task.id), 'Task deleted')}><Trash2 size={16}/></button></div></div>)}</section>
}

function ExamPanel({ subject, exams }: { subject: Subject; exams: Exam[] }) {
  const { run } = useApp()
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Exam | null>(null)
  const [name, setName] = useState(''), [date, setDate] = useState(''), [importance, setImportance] = useState(3)
  const begin = (exam?: Exam) => { setEditing(exam ?? null); setName(exam?.name ?? ''); setDate(exam?.date ?? ''); setImportance(exam?.importance ?? 3); setOpen(true) }
  const save = () => void run(async () => {
    if (!name.trim() || !date) throw new Error('Name and date are required')
    await db.exams.put({ id: editing?.id ?? crypto.randomUUID(), subjectId: subject.id, name: name.trim(), date, importance }); setOpen(false)
  }, editing ? 'Exam updated' : 'Exam added')
  return <section className="stack"><div className="row between"><h3>Exams</h3><button className="button-quiet" onClick={() => begin()}><Plus size={16}/> Add exam</button></div>
    {open && <form className="panel compact-form" onSubmit={event => { event.preventDefault(); save() }}>
      <label className="field">Exam name<input required value={name} onChange={event => setName(event.target.value)}/></label>
      <div className="field-grid"><label className="field">Date<input type="date" required value={date} onChange={event => setDate(event.target.value)}/></label>
        <label className="field">Priority<select value={importance} onChange={event => setImportance(Number(event.target.value))}>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label></div>
      <div className="row wrap"><button className="button-primary" type="submit">Save exam</button><button className="button-quiet" type="button" onClick={() => setOpen(false)}>Cancel</button></div></form>}
    {exams.length === 0 && <div className="empty-state small"><p>No exams here. Add one to guide priority.</p></div>}
    {[...exams].sort((a, b) => a.date.localeCompare(b.date)).map(exam => <div className="list-card" key={exam.id}><div><strong>{exam.name}</strong><small>{exam.date} · Priority {exam.importance}/5</small></div>
      <div className="row"><button className="icon-button" aria-label={`Edit ${exam.name}`} onClick={() => begin(exam)}><Pencil size={16}/></button>
        <button className="icon-button danger" aria-label={`Delete ${exam.name}`} onClick={() => confirmDelete(exam.name) && void run(() => db.exams.delete(exam.id), 'Exam deleted')}><Trash2 size={16}/></button></div></div>)}</section>
}

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowRight, Clock3, RotateCcw, MoreHorizontal } from 'lucide-react'
import { planToday } from '../../domain/planner'
import { db } from '../../storage/db'
import { useApp } from '../../app/context'
import { duration, localDay } from '../../app/utils'

export function TodayPage() {
  const { data, run, startFocus, go } = useApp()
  const today = localDay()
  const [dragged, setDragged] = useState<string | null>(null)
  const available = data.settings?.dailyMinutes ?? 120
  const recentMinutesBySubject = useMemo(() => {
    const start = new Date(); start.setDate(start.getDate() - 7)
    return Object.fromEntries(data.subjects.map(subject => [subject.id,
      data.sessions.filter(session => session.subjectId === subject.id && session.createdAt >= start.toISOString())
        .reduce((sum, session) => sum + session.minutes, 0)]))
  }, [data.sessions, data.subjects])
  const plan = useMemo(() => planToday({ tasks: data.tasks, exams: data.exams, availableMinutes: available,
    recentMinutesBySubject, weights: data.settings?.priorityWeights, today }), [data.tasks, data.exams, available, recentMinutesBySubject, data.settings?.priorityWeights, today])
  useEffect(() => {
    if (data.plans.some(saved => saved.id === today)) return
    void db.plans.put({ id: today, taskIds: plan.items.map(item => item.taskId),
      plannedMinutes: plan.totalMinutes, savedAt: new Date().toISOString() })
  }, [data.plans, plan.items, plan.totalMinutes, today])
  const studied = data.sessions.filter(session => localDay(new Date(session.createdAt)) === today).reduce((sum, session) => sum + session.minutes, 0)
  const completed = data.tasks.filter(task => task.completedAt && localDay(new Date(task.completedAt)) === today).length
  const progress = plan.items.length + completed ? Math.round(completed / (plan.items.length + completed) * 100) : 0
  const dueWords = data.words.filter(word => word.status === 'learning' && (!word.nextReviewAt || word.nextReviewAt <= today)).length
  const dueMistakes = data.mistakes.filter(mistake => !mistake.mastered && (!mistake.nextReviewAt || mistake.nextReviewAt <= today)).length
  const dueTopics = data.topics.filter(topic => !topic.nextReviewAt || topic.nextReviewAt <= today).length

  const setAvailable = (minutes: number) => void run(async () => {
    if (data.settings) await db.settings.put({ ...data.settings, dailyMinutes: minutes })
  })
  const move = (id: string, direction: -1 | 1) => void run(async () => {
    const ids = plan.items.map(item => item.taskId)
    const from = ids.indexOf(id), to = from + direction
    if (to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    await db.tasks.bulkPut(ids.map((taskId, index) => ({ ...data.tasks.find(task => task.id === taskId)!, manualOrder: index })))
  })
  const reorder = (source: string, target: string) => void run(async () => {
    const ids = plan.items.map(item => item.taskId)
    const oldIndex = ids.indexOf(source), newIndex = ids.indexOf(target)
    if (oldIndex < 0 || newIndex < 0) return
    ids.splice(oldIndex, 1); ids.splice(newIndex, 0, source)
    await db.tasks.bulkPut(ids.map((taskId, index) => ({ ...data.tasks.find(task => task.id === taskId)!, manualOrder: index })))
  })

  return <div className="today-page page-grid">
    <div className="primary-column">
      <div className="page-intro"><div className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</div>
        <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}.</h1>
        <p>A clear plan for the time you have today.</p></div>
      <div className="today-summary"><div><strong>{progress}%</strong><span>complete today</span></div>
        <div><strong>{duration(plan.totalMinutes)}</strong><span>planned</span></div>
        <div><strong>{duration(studied)}</strong><span>studied</span></div></div>
      <section className="section plan-section"><div className="section-head"><div><div className="eyebrow">YOUR NEXT STEPS</div><h2>Today plan</h2></div>
        <span className="count-pill">{plan.items.length} tasks</span></div>
        <div className="availability"><span>Available today</span><div className="time-options">{[60, 120, 180, 240].map(value =>
          <button key={value} className={available === value ? 'active' : ''} onClick={() => setAvailable(value)}>{value / 60}h</button>)}
          <label className="sr-only" htmlFor="today-custom-time">Custom time</label>
          <input id="today-custom-time" type="number" aria-label="Custom time in minutes" min={15} max={600}
            value={available} onChange={event => setAvailable(Math.max(15, Math.min(600, Number(event.target.value) || 15)))}/><span>min</span></div></div>
        {plan.items.length === 0 && <div className="empty-state"><RotateCcw size={22}/><h3>Your plan is clear.</h3>
          <p>Add a task in Learn, or review what is due.</p><button onClick={() => go('learn')}>Open Learn <ArrowRight size={16}/></button></div>}
        <div className="plan-list">{plan.items.map((item, index) => {
          const task = data.tasks.find(candidate => candidate.id === item.taskId)!
          const subject = data.subjects.find(candidate => candidate.id === task.subjectId)
          return <article className="plan-card" key={task.id} draggable
            onDragStart={() => setDragged(task.id)} onDragOver={event => event.preventDefault()}
            onDrop={() => { if (dragged) reorder(dragged, task.id); setDragged(null) }}>
            <div className="plan-number">{String(index + 1).padStart(2, '0')}</div>
            <div className="plan-body"><div className="row between wrap"><span className="subject-label">{subject?.name ?? 'Study'}</span>
              <span className="score-label">PRIORITY {item.score.toFixed(0)}</span></div>
              <h3>{task.title}</h3>{task.quantity && <div className="task-quantity">{task.quantity}</div>}
              <div className="plan-meta"><Clock3 size={14}/>{duration(item.minutes)} planned{task.deadline && <span> · Due {task.deadline}</span>}</div>
              {item.reasons.length > 0 && <p className="plan-reason">{item.reasons.join(' · ')}</p>}
              <div className="plan-actions"><button className="button-primary" onClick={() => startFocus(task)}>Start <ArrowRight size={16}/></button>
                <button className="icon-button" aria-label={`Move ${task.title} up`} onClick={() => move(task.id, -1)} disabled={index === 0}><ArrowUp size={17}/></button>
                <button className="icon-button" aria-label={`Move ${task.title} down`} onClick={() => move(task.id, 1)} disabled={index === plan.items.length - 1}><ArrowDown size={17}/></button>
                <details className="action-menu"><summary aria-label={`More actions for ${task.title}`}><MoreHorizontal size={19}/></summary>
                  <div className="action-pop"><button onClick={() => void run(() => db.tasks.put({ ...task, skippedOn: today }), 'Skipped for today')}>Skip today</button>
                    <button onClick={() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); void run(() => db.tasks.put({ ...task, postponedUntil: localDay(tomorrow) }), 'Moved to tomorrow') }}>Tomorrow</button>
                    <button onClick={() => void run(() => db.tasks.put({ ...task, estimatedMinutes: Math.max(15, task.estimatedMinutes - 15) }))}>Reduce by 15m</button>
                    <button onClick={() => void run(() => db.tasks.put({ ...task, estimatedMinutes: Math.min(120, task.estimatedMinutes + 15) }))}>Add 15m</button></div></details></div>
            </div></article>
        })}</div></section>
      </div>
    <aside className="today-aside"><section className="side-card"><div className="eyebrow">KEEP IT MOVING</div><h2>Review due</h2>
      <div className="due-row"><span>Vocabulary</span><strong>{dueWords}</strong></div>
      <div className="due-row"><span>Math & other mistakes</span><strong>{dueMistakes}</strong></div>
      <div className="due-row"><span>Knowledge topics</span><strong>{dueTopics}</strong></div>
      <button className="text-link" onClick={() => go('review')}>Open review <ArrowRight size={16}/></button></section>
      <section className="side-card"><div className="eyebrow">TODAY SO FAR</div><h2>{duration(studied)} / {duration(available)}</h2>
        <div className="progress-track"><span style={{ width: `${Math.min(100, studied / Math.max(1, available) * 100)}%` }}/></div>
        <p>{completed} task{completed === 1 ? '' : 's'} completed. Unfinished work stays ready for your next study day.</p></section></aside>
  </div>
}

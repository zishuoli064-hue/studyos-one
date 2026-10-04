import { useMemo, useState } from 'react'
import { ChartNoAxesCombined } from 'lucide-react'
import { useApp } from '../../app/context'
import { duration, localDay } from '../../app/utils'
import { calculateWeeklyReview } from '../../domain/weekly'

type Range = 'today' | '7 days' | '30 days'
const daysAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return localDay(date) }

export function ProgressPage() {
  const { data } = useApp()
  const [range, setRange] = useState<Range>('7 days')
  const since = range === 'today' ? localDay() : daysAgo(range === '7 days' ? 6 : 29)
  const sessions = useMemo(() => data.sessions.filter(session => localDay(new Date(session.createdAt)) >= since), [data.sessions, since])
  const minutes = sessions.reduce((sum, session) => sum + Math.max(0, session.minutes), 0)
  const completed = data.tasks.filter(task => task.completedAt && localDay(new Date(task.completedAt)) >= since).length
  const newWords = data.words.filter(word => localDay(new Date(word.createdAt)) >= since).length
  const reviews = sessions.filter(session => session.kind === 'review' || session.kind === 'mistake').length
  const quizResults = data.quizResults.filter(result => localDay(new Date(result.createdAt)) >= since)
  const accuracy = quizResults.length ? Math.round(quizResults.filter(result => result.correct).length / quizResults.length * 100) : null
  const mathIds = new Set(data.subjects.filter(subject => subject.kind === 'math').map(subject => subject.id))
  const germanIds = new Set(data.subjects.filter(subject => subject.kind === 'german').map(subject => subject.id))
  const mathReviews = sessions.filter(session => session.kind === 'mistake' && mathIds.has(session.subjectId)).length
  const germanMinutes = sessions.filter(session => germanIds.has(session.subjectId)).reduce((sum, session) => sum + session.minutes, 0)
  const subjectTotals = data.subjects.map(subject => ({ subject,
    minutes: sessions.filter(session => session.subjectId === subject.id).reduce((sum, session) => sum + session.minutes, 0) }))
    .filter(item => item.minutes > 0).sort((a, b) => b.minutes - a.minutes)
  const dayCount = range === 'today' ? 1 : range === '7 days' ? 7 : 30
  const days = Array.from({ length: dayCount }, (_, index) => daysAgo(dayCount - 1 - index))
  const daily = days.map(day => ({ day, minutes: sessions.filter(session => localDay(new Date(session.createdAt)) === day)
    .reduce((sum, session) => sum + session.minutes, 0) }))
  const maxDaily = Math.max(1, ...daily.map(day => day.minutes))

  const week = calculateWeeklyReview(data, localDay())
  const suggestions = [
    week.quizAccuracy !== null && week.quizAccuracy < 75 ? 'Vocabulary accuracy was below 75%. Revisit weak words before adding another full list.' : '',
    week.minutes < (data.settings?.dailyMinutes ?? 120) * 3 ? 'This week was lighter. A smaller daily plan may be easier to finish.' : '',
    data.tasks.some(task => /listening/i.test(task.title)) && !data.sessions.filter(session => localDay(new Date(session.createdAt)) >= week.since)
      .some(session => data.tasks.some(task => task.id === session.taskId && /listening/i.test(task.title)))
      ? 'Listening has not appeared in your study logs this week. Consider a short session next week.' : '',
  ].filter(Boolean)

  return <div className="progress-page"><div className="page-intro"><div className="eyebrow">A CLEARER PICTURE</div>
    <h1>Progress.</h1><p>See where your time went, without chasing a score.</p></div>
    <div className="segmented range-switch" role="group" aria-label="Time range">{(['today', '7 days', '30 days'] as Range[]).map(option =>
      <button key={option} className={range === option ? 'active' : ''} onClick={() => setRange(option)}>{option}</button>)}</div>
    <div className="stat-grid progress-stats"><div className="stat-card"><span>Study time</span><strong>{duration(minutes)}</strong></div>
      <div className="stat-card"><span>Tasks done</span><strong>{completed}</strong></div>
      <div className="stat-card"><span>New words</span><strong>{newWords}</strong></div>
      <div className="stat-card"><span>Reviews</span><strong>{reviews}</strong></div>
      <div className="stat-card"><span>Word quiz accuracy</span><strong>{accuracy === null ? '—' : `${accuracy}%`}</strong></div>
      <div className="stat-card"><span>Math mistake reviews</span><strong>{mathReviews}</strong></div>
      <div className="stat-card"><span>German study</span><strong>{duration(germanMinutes)}</strong></div></div>
    <div className="progress-columns"><section className="panel chart-panel"><div className="eyebrow">WHEN YOU LEARNED</div><h2>Study time by day</h2>
      {minutes ? <div className={`daily-chart ${dayCount === 30 ? 'dense' : ''}`} role="img" aria-label="Study minutes by day">
        {daily.map(item => <div className="daily-column" key={item.day} title={`${item.day}: ${item.minutes} minutes`}>
          <div className="daily-bar-area"><span style={{ height: `${Math.max(item.minutes ? 5 : 1, item.minutes / maxDaily * 100)}%` }}/></div>
          {(dayCount <= 7 || item.day.endsWith('01') || item.day.endsWith('15')) && <small>{item.day.slice(5)}</small>}</div>)}</div> :
        <div className="empty-state small"><ChartNoAxesCombined size={22}/><p>No study logs in this range yet.</p></div>}
      <small className="chart-unit">Minutes per day · hover for exact values</small></section>
      <section className="panel chart-panel"><div className="eyebrow">WHERE IT WENT</div><h2>Subject breakdown</h2>
        {subjectTotals.length ? subjectTotals.map(item => <div className="subject-breakdown" key={item.subject.id}>
          <div className="row between"><span>{item.subject.name}</span><strong>{Math.round(item.minutes / Math.max(1, minutes) * 100)}% · {duration(item.minutes)}</strong></div>
          <div className="progress-track"><span style={{ width: `${item.minutes / Math.max(1, minutes) * 100}%` }}/></div></div>) :
          <p className="muted">Log a session to see your subject mix.</p>}</section></div>
    <section className="panel weekly-panel"><div className="eyebrow">YOUR WEEKLY REVIEW</div><h2>Last 7 days</h2>
      <div className="weekly-grid"><div><span>Study time</span><strong>{duration(week.minutes)}</strong></div>
        <div><span>Tasks completed</span><strong>{week.completedTasks}</strong></div>
        <div><span>Vocabulary accuracy</span><strong>{week.quizAccuracy === null ? 'No quiz yet' : `${week.quizAccuracy}%`}</strong></div>
        <div><span>Plan completion</span><strong>{week.planCompletion === null ? 'No plan saved' : `${week.planCompletion}% of ${week.plannedTasks} tasks`}</strong></div>
        <div><span>German vocabulary</span><strong>{week.germanWords} words · {duration(week.germanMinutes)}</strong></div>
        <div><span>Math error types</span><strong>{Object.keys(week.mathErrorTypes).length ? Object.entries(week.mathErrorTypes).map(([kind, count]) => `${kind} ${count}`).join(' · ') : 'None'}</strong></div></div>
      {week.weakWords.length > 0 && <p><strong>Words to revisit:</strong> {week.weakWords.map(word => word.word).join(' · ')}</p>}
      <div className="week-adjust"><strong>Next week adjustment</strong><p>{suggestions[0] || 'Keep the rhythm that fits your schedule. Your unfinished tasks will remain ready.'}</p></div></section>
  </div>
}

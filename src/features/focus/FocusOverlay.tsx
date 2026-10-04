import { useEffect, useState } from 'react'
import { Check, Pause, Play, X } from 'lucide-react'
import type { Task } from '../../domain/types'
import { db } from '../../storage/db'
import { completeTask } from '../../storage/actions'
import { useApp } from '../../app/context'

interface TimerState { accumulated: number; startedAt: number | null; targetMinutes: 0 | 25 | 50 | 90 }
const timerKey = (id: string) => `studyos-one-focus-${id}`
const readTimer = (id: string, defaultTimer: 0 | 25 | 50 | 90): TimerState => {
  try { const saved = JSON.parse(localStorage.getItem(timerKey(id)) || 'null') as TimerState | null
    if (saved && Number.isFinite(saved.accumulated)) return { ...saved, targetMinutes: saved.targetMinutes ?? defaultTimer } } catch { /* ignore damaged timer state */ }
  return { accumulated: 0, startedAt: Date.now(), targetMinutes: defaultTimer }
}

export function FocusOverlay({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data, run, notify } = useApp()
  const [timer, setTimer] = useState<TimerState>(() => readTimer(task.id, data.settings?.defaultTimer ?? 0))
  const [now, setNow] = useState(Date.now())
  const [finishing, setFinishing] = useState(false)
  const [actualMinutes, setActualMinutes] = useState<number | null>(null)
  const [focusScore, setFocusScore] = useState(4)
  const [mastery, setMastery] = useState(task.mastery ?? 50)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { localStorage.setItem(timerKey(task.id), JSON.stringify(timer)) }, [timer, task.id])
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  const seconds = Math.max(0, Math.floor((timer.accumulated + (timer.startedAt ? now - timer.startedAt : 0)) / 1000))
  const clock = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const toggle = () => setTimer(previous => previous.startedAt ?
    { ...previous, accumulated: previous.accumulated + (Date.now() - previous.startedAt), startedAt: null } :
    { ...previous, startedAt: Date.now() })
  const complete = () => {
    if (saving) return
    setSaving(true)
    void run(async () => {
    const minutes = Math.max(1, Math.min(600, Math.round(actualMinutes ?? Math.max(1, seconds / 60))))
    await completeTask(db, task.id, { minutes, focusScore, mastery, note })
    localStorage.removeItem(timerKey(task.id))
    notify('Session saved. On to the next step.')
    onClose()
    }).finally(() => setSaving(false))
  }
  return <div className="focus-screen" role="dialog" aria-modal="true" aria-label="Focus mode">
    <div className="focus-top"><span>STUDYOS / FOCUS</span><button className="icon-button" onClick={onClose} aria-label="Close focus"><X size={22}/></button></div>
    <div className="focus-center"><div className="eyebrow">ONE THING AT A TIME</div><h1>{task.title}</h1>
      <p>{data.subjects.find(subject => subject.id === task.subjectId)?.name ?? 'Study'}</p>
      <div className="focus-clock" role="timer">{clock}</div>
      {!finishing && <><div className="segmented focus-presets" role="group" aria-label="Focus timer">{([0, 25, 50, 90] as const).map(value =>
        <button key={value} className={timer.targetMinutes === value ? 'active' : ''}
          onClick={() => setTimer(previous => ({ ...previous, targetMinutes: value }))}>{value ? `${value} min` : 'Free'}</button>)}</div>
        {timer.targetMinutes > 0 && <p className="focus-remaining">{Math.max(0, timer.targetMinutes - Math.floor(seconds / 60))} min remaining · finish when ready</p>}</>}
      {!finishing && <div className="focus-controls"><button onClick={toggle} className="button-quiet">
        {timer.startedAt ? <Pause size={19}/> : <Play size={19}/>} {timer.startedAt ? 'Pause' : 'Resume'}</button>
        <button className="button-primary" onClick={() => { setActualMinutes(Math.max(1, Math.round(seconds / 60))); setFinishing(true) }}>
          Finish session <Check size={18}/></button></div>}
      {finishing && <div className="focus-feedback"><h2>Nice work. Log this session.</h2>
        <div className="field-grid"><label className="field">Actual minutes<input type="number" min={1} max={600}
          value={actualMinutes ?? 1} onChange={event => setActualMinutes(Number(event.target.value))}/></label>
          <label className="field">Focus (1–5)<input type="number" min={1} max={5} value={focusScore}
            onChange={event => setFocusScore(Math.max(1, Math.min(5, Number(event.target.value) || 1)))}/></label></div>
        <label className="field">Mastery now (0–100)<input type="number" min={0} max={100} value={mastery}
          onChange={event => setMastery(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}/></label>
        <label className="field">Note (optional)<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="What clicked today?"/></label>
        <div className="row wrap"><button className="button-quiet" onClick={() => setFinishing(false)}>Back to timer</button>
          <button className="button-primary" onClick={complete} disabled={saving}>{saving ? 'Saving…' : 'Save & done'} <Check size={17}/></button></div></div>}
    </div><div className="focus-foot">Small steps add up. Your timer stays if you leave this screen.</div>
  </div>
}

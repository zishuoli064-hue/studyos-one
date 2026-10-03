import { useState } from 'react'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { DEFAULT_SETTINGS, type SubjectKind } from '../../domain/types'
import { db, seedDemo } from '../../storage/db'

const KINDS: { kind: SubjectKind; label: string; detail: string }[] = [
  { kind: 'english', label: 'English', detail: 'CET-4 words & practice' },
  { kind: 'german', label: 'German', detail: 'A1 and beyond' },
  { kind: 'math', label: 'Math', detail: 'Topics & mistakes' },
  { kind: 'course', label: 'Courses', detail: 'University subjects' },
]

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [minutes, setMinutes] = useState(120)
  const [kinds, setKinds] = useState<SubjectKind[]>(['english', 'german', 'math'])
  const [wordsPerList, setWordsPerList] = useState(50)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const finish = async () => {
    setBusy(true)
    try {
      const settings = { ...DEFAULT_SETTINGS, dailyMinutes: minutes, wordsPerList, selectedKinds: kinds, onboardingDone: true }
      await seedDemo(db, settings)
      await db.settings.put(settings)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your setup') }
    finally { setBusy(false) }
  }
  return <main className="onboarding">
    <div className="onboard-brand"><span className="brand-mark">S</span><strong>StudyOS <span>ONE</span></strong></div>
    <div className="onboard-card">
      <div className="eyebrow">MAKE SPACE TO LEARN · {step + 1} / 3</div>
      <div className="step-track"><span style={{ width: `${(step + 1) * 33.34}%` }}/></div>
      {step === 0 && <><Sparkles className="onboard-icon" size={30}/><h1>Build a day that fits.</h1>
        <p>How much time can you usually give to learning? You can change this any day.</p>
        <div className="choice-grid">{[60, 120, 180, 240].map(value => <button key={value}
          className={`choice ${minutes === value ? 'selected' : ''}`} onClick={() => setMinutes(value)}>
          {value / 60} hour{value > 60 ? 's' : ''}</button>)}</div>
        <label className="field">Custom minutes<input aria-label="Custom study minutes" type="number" min={15} max={600}
          value={minutes} onChange={event => setMinutes(Math.max(15, Math.min(600, Number(event.target.value) || 15)))}/></label></>}
      {step === 1 && <><h1>What are you learning?</h1><p>Pick a starting point. Subjects can be added or removed later.</p>
        <div className="subject-choices">{KINDS.map(item => <button key={item.kind} className={`subject-choice ${kinds.includes(item.kind) ? 'selected' : ''}`}
          onClick={() => setKinds(previous => previous.includes(item.kind) ? previous.filter(kind => kind !== item.kind) : [...previous, item.kind])}>
          <span><strong>{item.label}</strong><small>{item.detail}</small></span>{kinds.includes(item.kind) && <Check size={18}/>}</button>)}</div></>}
      {step === 2 && <><h1>Your word-list pace.</h1><p>Lists follow your progress, never the calendar.</p>
        <div className="choice-grid">{[20, 30, 50].map(value => <button key={value}
          className={`choice ${wordsPerList === value ? 'selected' : ''}`} onClick={() => setWordsPerList(value)}>
          {value} words</button>)}</div>
        <label className="field">Custom words per list<input aria-label="Custom words per list" type="number" min={1} max={200}
          value={wordsPerList} onChange={event => setWordsPerList(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}/></label>
        <div className="quiet-note">We'll add removable sample English, German, and Math content so you can explore immediately.</div></>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="onboard-actions">{step > 0 && <button className="button-quiet" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="button-primary" disabled={busy || (step === 1 && kinds.length === 0)}
          onClick={() => step < 2 ? setStep(step + 1) : void finish()}>
          {step < 2 ? 'Continue' : busy ? 'Setting up…' : 'Start StudyOS'} <ArrowRight size={17}/></button></div>
    </div>
    <p className="onboard-foot">Private by default · Stored on this device · Works offline</p>
  </main>
}

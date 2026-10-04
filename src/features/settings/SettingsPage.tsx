import { useState } from 'react'
import { Download, FileUp, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useApp } from '../../app/context'
import { exportBackup, importBackup } from '../../domain/backup'
import { mergeVocabulary, previewVocabularyCsv, VOCABULARY_CSV_TEMPLATE, type DuplicateStrategy } from '../../domain/import'
import { DEFAULT_SETTINGS, type AppSettings, type Snapshot } from '../../domain/types'
import { clearDemoData, db, replaceSnapshot } from '../../storage/db'
import { localDay } from '../../domain/date'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function csv(rows: (string | number | undefined)[][]): string {
  return rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n'
}
function counts(snapshot: Snapshot) {
  return `${snapshot.subjects.length} subjects · ${snapshot.tasks.length} tasks · ${snapshot.words.length} words · ${snapshot.sessions.length} sessions`
}

export function SettingsPage() {
  const { data, run, notify } = useApp()
  const settings = data.settings ?? DEFAULT_SETTINGS
  const [backupText, setBackupText] = useState('')
  const [backupName, setBackupName] = useState('')
  const [backupMode, setBackupMode] = useState<'merge' | 'replace'>('merge')
  const [csvText, setCsvText] = useState('')
  const [csvName, setCsvName] = useState('')
  const [csvSubject, setCsvSubject] = useState('')
  const [csvStrategy, setCsvStrategy] = useState<DuplicateStrategy>('skip')
  const [lastReset, setLastReset] = useState<Snapshot | null>(null)
  const [advanced, setAdvanced] = useState(false)

  const update = (changes: Partial<AppSettings>) => void run(() => db.settings.put({ ...settings, ...changes }))
  const exportAll = () => download(`studyos-backup-${localDay()}.json`, exportBackup(data), 'application/json')
  const restore = () => void run(async () => {
    if (!backupText) throw new Error('Choose a backup file first')
    const restored = importBackup(backupText, data, backupMode)
    if (backupMode === 'replace' && !window.confirm(`Replace this device's data with ${backupName}? Export a backup first if you need one.`)) return
    await replaceSnapshot(db, restored)
    setBackupText(''); setBackupName('')
  }, 'Backup restored')
  const english = data.subjects.find(subject => subject.kind === 'english')
  const german = data.subjects.find(subject => subject.kind === 'german')
  const vocabSubjects = data.subjects.filter(subject => subject.kind === 'english' || subject.kind === 'german')
  const target = vocabSubjects.find(subject => subject.id === csvSubject) ?? english ?? german
  const preview = csvText && target ? (() => { try { return previewVocabularyCsv(csvText, data.words, target.id, target.kind === 'german' ? 'de' : 'en') } catch { return null } })() : null
  const importCsv = () => void run(async () => {
    if (!target || !csvText) throw new Error('Choose a vocabulary subject and CSV file')
    const parsed = previewVocabularyCsv(csvText, data.words, target.id, target.kind === 'german' ? 'de' : 'en')
    if (!parsed.valid.length) throw new Error('No valid words found')
    const next = mergeVocabulary(data.words, parsed.valid, csvStrategy)
    await db.words.bulkPut(next)
    setCsvText(''); setCsvName('')
  }, 'Vocabulary imported')
  const clearDemo = () => void run(async () => {
    if (!window.confirm('Remove all sample data? Your own records will stay.')) return
    await clearDemoData()
  }, 'Sample data removed')
  const reset = () => void run(async () => {
    if (!window.confirm('Delete all StudyOS data on this device? Export a backup first.')) return
    setLastReset(data)
    await replaceSnapshot(db, { subjects: [], tasks: [], exams: [], words: [], lists: [], mistakes: [], topics: [], sessions: [], quizResults: [], notes: [], plans: [], settings })
  }, 'Local data reset')
  const updateWeight = (key: keyof NonNullable<AppSettings['priorityWeights']>, value: number) => {
    const weights = { ...DEFAULT_SETTINGS.priorityWeights!, ...settings.priorityWeights, [key]: value }
    update({ priorityWeights: weights })
  }
  const updateInterval = (index: number, value: number) => {
    const intervals = [...(settings.reviewIntervals ?? DEFAULT_SETTINGS.reviewIntervals!)] as [number, number, number, number]
    intervals[index] = value; update({ reviewIntervals: intervals })
  }

  return <div className="settings-page"><div className="page-intro"><div className="eyebrow">YOUR SPACE, YOUR RULES</div><h1>Settings.</h1>
    <p>Your learning data lives in this browser. Back it up when you change devices.</p></div>
    <div className="settings-grid"><section className="panel"><div className="section-head"><h2>Study preferences</h2></div>
      <div className="setting-row"><label htmlFor="daily-minutes">Daily study goal <small>Minutes available for your plan</small></label>
        <input id="daily-minutes" type="number" min="15" max="600" value={settings.dailyMinutes} onChange={event => update({ dailyMinutes: Math.max(15, Math.min(600, Number(event.target.value) || 15)) })}/></div>
      <div className="setting-row"><label htmlFor="list-size">Words per list <small>New lists use this size</small></label>
        <input id="list-size" type="number" min="1" max="200" value={settings.wordsPerList} onChange={event => update({ wordsPerList: Math.max(1, Math.min(200, Number(event.target.value) || 1)) })}/></div>
      <div className="setting-row"><label htmlFor="timer">Default focus timer</label><select id="timer" value={settings.defaultTimer} onChange={event => update({ defaultTimer: Number(event.target.value) as AppSettings['defaultTimer'] })}>
        <option value="0">No timer</option><option value="25">25 minutes</option><option value="50">50 minutes</option><option value="90">90 minutes</option></select></div>
      <div className="setting-row"><label htmlFor="theme">Appearance</label><select id="theme" value={settings.theme} onChange={event => update({ theme: event.target.value as AppSettings['theme'] })}>
        <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
      <div className="setting-row"><label htmlFor="font-size">Text size</label><select id="font-size" value={settings.fontScale} onChange={event => update({ fontScale: Number(event.target.value) })}>
        <option value="0.9">Compact</option><option value="1">Default</option><option value="1.1">Larger</option><option value="1.2">Largest</option></select></div>
      <label className="setting-row switch-row"><span>Show IPA in word cards</span><input type="checkbox" checked={settings.showIPA} onChange={event => update({ showIPA: event.target.checked })}/></label>
      <label className="setting-row switch-row"><span>Show Chinese example translations</span><input type="checkbox" checked={settings.showExampleCN} onChange={event => update({ showExampleCN: event.target.checked })}/></label>
    </section>
    <section className="panel"><div className="section-head"><div><h2>Backup & restore</h2><p>Use a JSON backup to move between devices.</p></div><ShieldCheck size={22}/></div>
      <div className="backup-summary">On this device: {counts(data)}</div>
      <button className="button-primary" onClick={exportAll}><Download size={16}/> Download full backup</button>
      <label className="field file-field">Choose backup JSON<input type="file" accept="application/json,.json" onChange={event => {
        const file = event.target.files?.[0]; if (!file) return
        void file.text().then(text => { setBackupText(text); setBackupName(file.name) }).catch(() => notify('Could not read that file'))
      }}/></label>
      {backupText && <div className="import-preview"><strong>{backupName}</strong><p>{(() => { try { const parsed = importBackup(backupText, data, 'replace'); return `Contains ${counts(parsed)}.` } catch { return 'Invalid StudyOS backup. Check the file before restoring.' } })()}</p>
        <label className="field">Restore mode<select value={backupMode} onChange={event => setBackupMode(event.target.value as 'merge' | 'replace')}><option value="merge">Merge with this device</option><option value="replace">Replace this device</option></select></label>
        <button className="button-quiet" onClick={restore}><FileUp size={16}/> Restore backup</button></div>}
      <p className="quiet-note">There is no cloud account or login. Each browser stores its own data; export a backup before clearing it or changing phones.</p>
    </section>
    <section className="panel"><div className="section-head"><div><h2>Import vocabulary</h2><p>Bring your own English or German words.</p></div></div>
      <button className="text-link" onClick={() => download('studyos-vocabulary-template.csv', VOCABULARY_CSV_TEMPLATE, 'text/csv;charset=utf-8')}><Download size={15}/> Download CSV template</button>
      <label className="field">Subject<select value={target?.id ?? ''} onChange={event => setCsvSubject(event.target.value)}>
        {vocabSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      {!target && <p className="quiet-note">Add an English or German subject in Learn first.</p>}
      <label className="field file-field">Choose vocabulary CSV<input type="file" accept="text/csv,.csv" onChange={event => {
        const file = event.target.files?.[0]; if (!file) return
        void file.text().then(text => { setCsvText(text); setCsvName(file.name) }).catch(() => notify('Could not read that file'))
      }}/></label>
      {csvText && <div className="import-preview"><strong>{csvName}</strong>{preview ? <p>{preview.valid.length} valid · {preview.invalid.length} invalid · {preview.duplicates.length} duplicates</p> : <p>CSV needs a Word column and valid rows.</p>}
        {preview && preview.invalid.slice(0, 4).map(row => <small key={row.row}>Row {row.row}: {row.reason}</small>)}
        <label className="field">When a word already exists<select value={csvStrategy} onChange={event => setCsvStrategy(event.target.value as DuplicateStrategy)}>
          <option value="skip">Skip duplicate</option><option value="merge">Fill missing details</option><option value="replace">Replace details</option></select></label>
        <button className="button-quiet" onClick={importCsv} disabled={!preview?.valid.length}>Import words</button></div>}
    </section>
    <section className="panel"><h2>Export tables</h2><p>Open these CSV files in a spreadsheet.</p><div className="row wrap">
      <button className="button-quiet" onClick={() => download('studyos-words.csv', csv([['Word','Meaning','Language','Subject','Mastery','Reviews','Errors'], ...data.words.map(word => [word.word, word.meaning, word.language, data.subjects.find(s => s.id === word.subjectId)?.name, word.mastery, word.reviewCount, word.errorCount])]), 'text/csv;charset=utf-8')}>Words CSV</button>
      <button className="button-quiet" onClick={() => download('studyos-mistakes.csv', csv([['Title','Topic','Problem','My Error','Correct Method','Mastery'], ...data.mistakes.map(item => [item.title,item.topic,item.problem,item.myError,item.correctMethod,item.mastery])]), 'text/csv;charset=utf-8')}>Mistakes CSV</button>
      <button className="button-quiet" onClick={() => download('studyos-study-log.csv', csv([['Date','Subject','Minutes','Kind','Focus'], ...data.sessions.map(item => [item.createdAt, data.subjects.find(s => s.id === item.subjectId)?.name, item.minutes, item.kind, item.focusScore])]), 'text/csv;charset=utf-8')}>Study log CSV</button></div></section>
    <section className="panel settings-wide"><button className="text-link" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>{advanced ? 'Hide' : 'Show'} planning rules</button>
      {advanced && <div className="advanced-settings"><p>Priority weights are relative. Review intervals apply to Forgot, Hard, Good and Easy.</p>
        <div className="field-grid three">{Object.entries(settings.priorityWeights ?? DEFAULT_SETTINGS.priorityWeights!).map(([key, value]) => <label className="field" key={key}>{key}<input type="number" min="0" max="100" value={value} onChange={event => updateWeight(key as keyof NonNullable<AppSettings['priorityWeights']>, Math.max(0, Math.min(100, Number(event.target.value) || 0)))}/></label>)}</div>
        <div className="field-grid">{(settings.reviewIntervals ?? DEFAULT_SETTINGS.reviewIntervals!).map((value, index) => <label className="field" key={index}>{['Forgot','Hard','Good','Easy'][index]} (days)<input type="number" min="1" max="365" value={value} onChange={event => updateInterval(index, Math.max(1, Math.min(365, Number(event.target.value) || 1)))}/></label>)}</div>
        <button className="button-quiet" onClick={() => update({ priorityWeights: DEFAULT_SETTINGS.priorityWeights, reviewIntervals: DEFAULT_SETTINGS.reviewIntervals })}>Restore defaults</button></div>}</section>
    <section className="panel settings-wide"><h2>Manage local data</h2><div className="row wrap">
      <button className="button-quiet" onClick={clearDemo}><Trash2 size={16}/> Remove sample content</button>
      <button className="button-danger" onClick={reset}><RotateCcw size={16}/> Reset this device</button>
      {lastReset && <button className="button-quiet" onClick={() => void run(async () => { await replaceSnapshot(db, lastReset); setLastReset(null) }, 'Data restored')}>Undo reset</button>}
    </div><p className="quiet-note">Reset clears this browser's StudyOS data. A full backup is the safest way to keep it.</p></section></div>
  </div>
}

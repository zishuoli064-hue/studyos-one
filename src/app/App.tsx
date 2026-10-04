import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import { BookOpen, CalendarDays, ChartNoAxesCombined, Settings2, RotateCcw, Plus, WifiOff } from 'lucide-react'
import type { Task, Snapshot } from '../domain/types'
import { readSnapshot } from '../storage/db'
import { AppContext, type Page } from './context'
import { Onboarding } from '../features/onboarding/Onboarding'
import { ErrorBoundary } from './ErrorBoundary'

const TodayPage = lazy(() => import('../features/today/TodayPage').then(module => ({ default: module.TodayPage })))
const LearnPage = lazy(() => import('../features/learn/LearnPage').then(module => ({ default: module.LearnPage })))
const ReviewPage = lazy(() => import('../features/review/ReviewPage').then(module => ({ default: module.ReviewPage })))
const ProgressPage = lazy(() => import('../features/progress/ProgressPage').then(module => ({ default: module.ProgressPage })))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then(module => ({ default: module.SettingsPage })))
const FocusOverlay = lazy(() => import('../features/focus/FocusOverlay').then(module => ({ default: module.FocusOverlay })))
const CaptureModal = lazy(() => import('../features/capture/CaptureModal').then(module => ({ default: module.CaptureModal })))

const NAV: { id: Page; label: string; icon: typeof CalendarDays }[] = [
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'review', label: 'Review', icon: RotateCcw },
  { id: 'progress', label: 'Progress', icon: ChartNoAxesCombined },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export function App() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [page, setPage] = useState<Page>('today')
  const [focusTask, setFocusTask] = useState<Task | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const subscription = liveQuery(() => readSnapshot()).subscribe({
      next: snapshot => { setData(snapshot); setStorageError(null) },
      error: error => setStorageError(error instanceof Error ? error.message : 'Storage could not be opened'),
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    const theme = data?.settings?.theme ?? 'system'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.setProperty('--font-scale', String(data?.settings?.fontScale ?? 1))
  }, [data?.settings?.theme, data?.settings?.fontScale])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 4200)
    return () => clearTimeout(id)
  }, [toast])

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try { await action(); if (success) setToast(success) }
    catch (error) { setToast(error instanceof Error ? error.message : 'Something went wrong. Your data was not changed.') }
  }
  const context = useMemo(() => data ? ({ data, page, go: setPage, run, startFocus: setFocusTask,
    openCapture: () => setCaptureOpen(true), notify: setToast }) : null, [data, page])

  if (storageError) return <main className="error-screen"><h1>StudyOS needs storage access</h1>
    <p>{storageError}</p><p>Check browser private mode or storage permissions, then reload.</p>
    <button onClick={() => location.reload()}>Retry</button></main>
  if (!data) return <main className="loading-screen">Opening StudyOS…</main>
  if (!data.settings?.onboardingDone) return <Onboarding />

  return <AppContext.Provider value={context!}>
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <div className="brand"><span className="brand-mark">S</span><span>StudyOS <small>ONE</small></span></div>
        <div className="sidebar-caption">Your learning, in motion.</div>
        <nav aria-label="Main navigation">{NAV.map(item => <button className={`nav-item ${page === item.id ? 'active' : ''}`}
          key={item.id} onClick={() => setPage(item.id)} aria-current={page === item.id ? 'page' : undefined}>
          <item.icon size={19}/><span>{item.label}</span></button>)}</nav>
        <div className="sidebar-bottom"><span className={`status-dot ${online ? '' : 'offline'}`}/>{online ? 'Ready to learn' : 'Offline · your data is here'}</div>
      </aside>
      <div className="app-main">
        <header className="mobile-header"><span className="brand-mark">S</span><strong>StudyOS <span>ONE</span></strong>
          {!online && <WifiOff size={17} aria-label="Offline"/>}<button aria-label="Quick capture" onClick={() => setCaptureOpen(true)}><Plus size={20}/></button></header>
        <div className="page-wrap"><ErrorBoundary key={page}><Suspense fallback={<div className="loading-section">Loading…</div>}>
          {page === 'today' && <TodayPage/>}
          {page === 'learn' && <LearnPage/>}
          {page === 'review' && <ReviewPage/>}
          {page === 'progress' && <ProgressPage/>}
          {page === 'settings' && <SettingsPage/>}
        </Suspense></ErrorBoundary></div>
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">{NAV.map(item => <button key={item.id}
        className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}
        aria-label={item.label} aria-current={page === item.id ? 'page' : undefined}>
        <item.icon size={21}/><span>{item.label}</span></button>)}</nav>
      <button className="capture-fab" onClick={() => setCaptureOpen(true)} aria-label="Quick capture"><Plus size={24}/></button>
      <Suspense fallback={null}>{focusTask && <FocusOverlay task={focusTask} onClose={() => setFocusTask(null)}/>}
        {captureOpen && <CaptureModal onClose={() => setCaptureOpen(false)}/>}</Suspense>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  </AppContext.Provider>
}

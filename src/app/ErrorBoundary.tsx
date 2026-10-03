import { Component, type ErrorInfo, type ReactNode } from 'react'
import { exportBackup } from '../domain/backup'
import { readSnapshot } from '../storage/db'
import { downloadFile, localDay } from './utils'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('StudyOS page error', error, info) }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="error-screen">
      <h1>This page ran into a problem</h1>
      <p>Your data is still stored on this device. You can back it up before reloading.</p>
      <div className="row wrap">
        <button onClick={() => this.setState({ error: null })}>Try again</button>
        <button onClick={() => location.reload()}>Reload app</button>
        <button onClick={async () => {
          try { downloadFile(`studyos_backup_${localDay()}.json`, exportBackup(await readSnapshot()), 'application/json') }
          catch { alert('Backup is unavailable while storage cannot be opened.') }
        }}>Export backup</button>
      </div>
    </main>
  }
}

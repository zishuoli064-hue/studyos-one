import { createContext, useContext } from 'react'
import type { Snapshot, Task } from '../domain/types'

export type Page = 'today' | 'learn' | 'review' | 'progress' | 'settings'
export interface AppContextValue {
  data: Snapshot
  page: Page
  go: (page: Page) => void
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>
  startFocus: (task: Task) => void
  openCapture: () => void
  notify: (message: string) => void
}

export const AppContext = createContext<AppContextValue | null>(null)
export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('App context missing')
  return value
}

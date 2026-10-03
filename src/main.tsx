import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import './style.css'

registerSW({ immediate: true })
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>,
)

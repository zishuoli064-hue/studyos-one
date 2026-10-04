# StudyOS ONE

A private, installable learning workspace for English, German, math, courses, and projects.

Built with React, TypeScript, Vite, Dexie/IndexedDB, and a service worker. The interface is designed for phones and scales to desktop.

## Start

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open the local URL shown by Vite. The three-step setup adds removable sample content. No account is needed.

## Daily flow

Today builds a time-boxed plan from exams, importance, weakness, review need, deadlines, and subject continuity. Learn manages subjects, tasks, exams, vocabulary lists, math topics, and mistakes. Review schedules words, topics, and mistakes with four recall ratings. Focus logs actual study time and task feedback. Progress summarizes sessions and quiz results. Quick Capture saves a task, word, mistake, or note.

StudyOS ONE stores all data in this browser's IndexedDB. It works offline after the first visit. Different devices have separate data. Settings can export a full JSON backup, restore it on another device, and import vocabulary from CSV. Export a backup before clearing browser data or changing devices.

## Project structure

- `src/domain/` contains the planner, review rules, vocabulary, backup, and weekly summary calculations.
- `src/storage/` owns IndexedDB and sample data.
- `src/features/` contains the five pages and focused workflows.
- `src/app/` contains navigation, shared context, and the error boundary.
- `tests/` covers algorithms, backup, and storage transactions.

## Verify and build

```bash
npm test
npm run build
npm run preview
```

The existing Python/Streamlit StudyOS V1 project is separate and remains usable locally. This PWA is a new client application; it does not connect to the V1 Supabase database. The public PWA opens without a password; its learning data is private to each browser profile.

## Hosting

The GitHub Pages workflow runs tests and builds the PWA under `/studyos-one/`. No passwords, database URLs, or server secrets are required because all personal learning data stays on the device.

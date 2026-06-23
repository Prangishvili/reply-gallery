// Crash breadcrumbs that survive a tab kill + reload.
//
// iOS Safari gives no memory API and console logs vanish when the tab is jetsammed,
// so we persist step-by-step markers to localStorage. After the crash reloads the
// page, the trail from the previous run is still there — the last marker before the
// reload boundary shows where (and therefore roughly why) it died.

const KEY = 'make_crash_log'
const FLAG = 'make_debug'
const MAX = 120

type Crumb = { t: number; msg: string }

export function crumb(msg: string) {
  try {
    const arr: Crumb[] = JSON.parse(localStorage.getItem(KEY) || '[]')
    arr.push({ t: Date.now(), msg })
    while (arr.length > MAX) arr.shift()
    localStorage.setItem(KEY, JSON.stringify(arr))
  } catch {}
}

export function readCrumbs(): Crumb[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function clearCrumbs() {
  try { localStorage.removeItem(KEY) } catch {}
}

export function debugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const p = new URLSearchParams(window.location.search).get('debug')
    if (p === '1') { localStorage.setItem(FLAG, '1'); return true }
    if (p === '0') { localStorage.removeItem(FLAG); return false }
    return localStorage.getItem(FLAG) === '1'
  } catch { return false }
}

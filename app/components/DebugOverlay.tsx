'use client'

import { useEffect, useState } from 'react'
import { readCrumbs, clearCrumbs, crumb } from '@/app/lib/crash-log'

// On-screen crash log. Shown on /make when debug is enabled (visit /make?debug=1 once;
// the flag persists so it survives navigation in from circle and survives crashes).
export function DebugOverlay() {
  const [crumbs, setCrumbs] = useState<{ t: number; msg: string }[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const refresh = () => setCrumbs(readCrumbs())
    refresh()
    const id = setInterval(refresh, 400)

    const onErr = (e: ErrorEvent) => crumb('window.onerror: ' + (e.message || 'unknown') + ' @' + (e.filename || '') + ':' + e.lineno)
    const onRej = (e: PromiseRejectionEvent) => crumb('unhandledrejection: ' + String(e.reason))
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => { clearInterval(id); window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej) }
  }, [])

  const t0 = crumbs[0]?.t ?? 0

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, zIndex: 9999,
      width: open ? 'min(92vw, 420px)' : 'auto',
      maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      background: 'rgba(0,0,0,0.86)', color: '#0f0',
      fontFamily: 'ui-monospace, monospace', fontSize: 10, lineHeight: 1.5,
      borderBottomLeftRadius: 8, pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', gap: 8, padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#fff', alignItems: 'center' }}>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: '1px solid #555', color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}>{open ? 'hide' : 'log'}</button>
        {open && <>
          <span style={{ flex: 1 }}>crash log ({crumbs.length})</span>
          <button onClick={() => { clearCrumbs(); setCrumbs([]) }} style={{ background: 'none', border: '1px solid #555', color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}>clear</button>
          <button onClick={() => { navigator.clipboard?.writeText(readCrumbs().map(c => `+${c.t - t0}ms ${c.msg}`).join('\n')) }} style={{ background: 'none', border: '1px solid #555', color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}>copy</button>
        </>}
      </div>
      {open && (
        <div style={{ overflowY: 'auto', padding: '6px 8px', wordBreak: 'break-word' }}>
          {crumbs.map((c, i) => {
            const reload = i > 0 && c.msg.includes('mount')
            return (
              <div key={i} style={{ color: c.msg.includes('!!!') || c.msg.includes('onerror') || c.msg.includes('rejection') ? '#f44' : (reload ? '#ff0' : '#0f0') }}>
                {reload ? '──── reload ────\n' : ''}+{c.t - t0}ms {c.msg}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

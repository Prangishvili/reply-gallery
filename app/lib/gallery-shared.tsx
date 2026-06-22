'use client'

import { useState } from 'react'
import type { WireframeStyle, CircleCameraMode, RoomCameraMode } from '../room'

export const STUDENTS = ['Mariam Wulaia','Nodar Gogichaishvili','Sesili Gurgenidze','Dominika Davshrishovi','Salome Shalvashvili','Nutsa Kavtelishvili','Ketevan Lomiashvili','Mariam Qsovreli','Ana Mamniashvili','Bako Shengelia','Sergi Sarajevi','Natali Chikhelidze']
export const ROOM_STUDENTS = [...STUDENTS, 'Name']

// ── Per-student image size & repeat defaults — edit values here ───────────────
// imgSize / repeat           → used when no audio is playing
// audioImgSize / audioRepeat → used when audio is playing (omit to keep same as static)
// facing: 'normal'           → images lie flat on the mesh surface
// facing: 'camera'           → images always face the camera (old billboard behaviour)
export type VertexSettings = { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal'; driftSpeed?: number; driftAmp?: number; driftEnabled?: boolean }
export const STUDENT_VERTEX_DEFAULTS: Record<string, VertexSettings> = {
  'Nodar Gogichaishvili':  { imgSize: 0.200, repeat: 9, driftSpeed: 0.2, driftAmp: 0.2, audioImgSize: 0.100, audioRepeat: 13, facing: 'camera', driftEnabled: true },
  'Sesili Gurgenidze':     { imgSize: 0.170, repeat: 11, audioImgSize: 0.110, audioRepeat: 11, facing: 'camera', driftEnabled: true },
  'Dominika Davshrishovi': { imgSize: 0.275, repeat: 17, driftSpeed: 0.4, driftAmp: 0.25, audioImgSize: 0.150, audioRepeat: 17, facing: 'camera', driftEnabled: true },
  'Nutsa Kavtelishvili':   { imgSize: 0.135, repeat: 19, driftSpeed: 0.6, driftAmp: 0.20, audioImgSize: 0.125, audioRepeat: 18, facing: 'camera', driftEnabled: true },
  'Ketevan Lomiashvili':   { imgSize: 0.150, repeat: 7, driftSpeed: 0.15, driftAmp: 0.50, audioImgSize: 0.100, audioRepeat: 7, facing: 'camera', driftEnabled: true },
  'Ana Mamniashvili':      { imgSize: 0.175, repeat: 12, audioImgSize: 0.115, audioRepeat: 9, facing: 'camera', driftEnabled: false },
  'Sergi Sarajevi':        { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1, facing: 'camera', driftEnabled: false },
  'Natali Chikhelidze':     { imgSize: 0.155, repeat: 15, driftSpeed: 0.45, driftAmp: 0.50, audioImgSize: 0.100, audioRepeat: 17, facing: 'camera', driftEnabled: true },
  'Salome Shalvashvili':   { imgSize: 0.095, repeat: 11, driftSpeed: 0.45, driftAmp: 0.50, audioImgSize: 0.065, audioRepeat: 11, facing: 'camera', driftEnabled: true },
  'Bako Shengelia':        { imgSize: 0.090, repeat: 30, audioImgSize: 0.090, audioRepeat: 17, facing: 'camera', driftEnabled: false },
  'Mariam Wulaia':         { imgSize: 0.065, repeat: 5, audioImgSize: 0.050, audioRepeat: 5, facing: 'camera', driftEnabled: false},
  'Mariam Qsovreli':       { imgSize: 0.135, repeat: 15, driftSpeed: 0.35, driftAmp: 0.50, audioImgSize: 0.090, audioRepeat: 15, facing: 'camera', driftEnabled: true },
}

export type ImageItem = { file: File; preview: string; caption: string }

export function fileToCaption(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}

export type Phase = 'entry' | 'gallery'

// ─── Admin settings ───────────────────────────────────────────────────────────

export type AdminSettings = {
  audioVolume: number
  timebombActive: boolean
  showFigure: boolean
  figureRadius: number
  figureSpeed: number
  figureX: number
  figureY: number
  figureZ: number
  figureScale: number
  figureFacing: number
  figureWireframe: boolean
  wireframeStyle: WireframeStyle
  dotSize: number
  circleDotSize: number
  circleDotSizeMobile: number
  circleShowImages: boolean
  dotColor: string
  dotCount: number
  circleDotCountMobile: number
  meshTexture: string | null
  texScale: number
  texOffsetX: number
  texOffsetY: number
  texRotation: number
  showVertexImages: boolean
  figureRings: boolean
  figureDrift: boolean
  soloReact: boolean
  circleRadius: number
  circleFigureFacing: number
  circleFigureY: number
  circleCameraMode: CircleCameraMode
  circleCamX: number
  circleCamY: number
  circleCamZ: number
  circleCamXM: number
  circleCamYM: number
  circleCamZM: number
  circleCamZoomM: number
  circleFigureYM: number
  circleCamFov: number
  circleCamZoom: number
  circleCamXLoop: boolean
  circleCamXLoopSpeed: number
  camX: number
  camY: number
  camZ: number
  roomCameraMode: RoomCameraMode
  roomCamFov: number
  roomCamZoom: number
  roomCamXLoop: boolean
  roomCamXLoopSpeed: number
  nutsaGlbScale: number
  nutsaGlbRepeat: number
}

export const ADMIN_DEFAULTS: AdminSettings = {
  audioVolume: 1.00,
  timebombActive: false,
  showFigure: true,
  figureRadius: 160,
  figureSpeed: 0.03,
  figureX: 0,
  figureY: -100,
  figureZ: 0,
  figureScale: 200,
  figureFacing: 4.80,
  figureWireframe: true,
  wireframeStyle: 'points',
  dotSize: 0.400,
  circleDotSize: 0.400,
  circleDotSizeMobile: 0.001,
  circleShowImages: true,
  dotColor: '#000000',
  dotCount: 5000,
  circleDotCountMobile: 5000,
  meshTexture: null,
  texScale: 1,
  texOffsetX: 0,
  texOffsetY: 0,
  texRotation: 0,
  showVertexImages: true,
  figureRings: true,
  figureDrift: true,
  soloReact: false,
  circleRadius: 500,
  circleFigureFacing: 4.65,
  circleFigureY: 200,
  circleCameraMode: 'perspective',
  circleCamX: 150,
  circleCamY: 4000,
  circleCamZ: -1350,
  circleCamXM: 0,
  circleCamYM: 0,
  circleCamZM: 0,
  circleCamZoomM: 0.20,
  circleFigureYM: 0,
  circleCamFov: 20,
  circleCamZoom: 1.2,
  circleCamXLoop: false,
  circleCamXLoopSpeed: 0.1,
  camX: 0,
  camY: 140,
  camZ: -35,
  roomCameraMode: 'perspective',
  roomCamFov: 90,
  roomCamZoom: 1,
  roomCamXLoop: false,
  roomCamXLoopSpeed: 1,
  nutsaGlbScale: 0.025,
  nutsaGlbRepeat: 1,
}

// ─── Admin panel components ───────────────────────────────────────────────────

export const P = {
  bg: '#0a0a0a',
  surface: '#131313',
  surface2: '#1a1a1a',
  border: '#232323',
  borderStrong: '#2e2e2e',
  text: '#e8e8e6',
  dim: '#7a7a78',
  low: '#4a4a48',
  accent: '#f0eb5c',
  font: 'var(--font-dm-mono), ui-monospace, monospace',
}

export function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: `1px solid ${P.border}`, padding: '16px 20px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        fontSize: 9, fontWeight: 600, letterSpacing: 2.5, color: P.dim, textTransform: 'uppercase' as const,
      }}>
        {title}
        <div style={{ flex: 1, height: 1, background: P.border }} />
      </div>
      {children}
    </div>
  )
}

export function PanelSlider({ label, value, min, max, step, decimals = 0, onChange }: {
  label: string; value: number; min: number; max: number; step: number; decimals?: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: P.text }}>{label}</span>
        <span style={{ fontSize: 11, color: P.accent, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
          {decimals === 0 ? value : value.toFixed(decimals)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: P.accent, cursor: 'pointer' }}
      />
    </div>
  )
}

export function PanelToggle({ options, value, onChange }: {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      background: P.surface2, border: `1px solid ${P.border}`, padding: 2, marginBottom: 12,
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            fontFamily: P.font, fontSize: 10, fontWeight: 500, letterSpacing: 1,
            padding: '7px 10px', border: 'none', cursor: 'pointer', textTransform: 'uppercase' as const,
            background: value === opt.value ? P.text : 'transparent',
            color: value === opt.value ? '#0a0a0a' : P.dim,
            transition: 'all 0.1s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function AdminPanel({
  admin, setAdmin,
  viewMode, setViewMode,
  hiddenCount, resetTimebomb,
  vertexImgSize, setVertexImgSize,
  vertexRepeat, setVertexRepeat,
  vertexAudioImgSize, setVertexAudioImgSize,
  vertexAudioRepeat, setVertexAudioRepeat,
  onAdminUpload,
  circleCameraInfoRef,
  studentTextures, setStudentTextures,
  nutsaGlbs, setNutsaGlbs,
  phase,
  hidden,
  circleFacing, setCircleFacing,
  studentVertexSettings, updateStudentVS,
  onCapture,
  onRecord,
  isRecording = false,
}: {
  admin: AdminSettings
  setAdmin: React.Dispatch<React.SetStateAction<AdminSettings>>
  viewMode: 'globe' | 'room' | 'circle' | 'self'; setViewMode: (v: 'globe' | 'room' | 'circle' | 'self') => void
  hiddenCount: number; resetTimebomb: () => void
  vertexImgSize: number; setVertexImgSize: (v: number) => void
  vertexRepeat: number; setVertexRepeat: (v: number) => void
  vertexAudioImgSize: number; setVertexAudioImgSize: (v: number) => void
  vertexAudioRepeat: number; setVertexAudioRepeat: (v: number) => void
  onAdminUpload: (file: File, studentName: string) => Promise<void>
  circleCameraInfoRef?: React.RefObject<HTMLDivElement | null>
  studentTextures: Record<string, string | null>; setStudentTextures: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
  nutsaGlbs: string[]; setNutsaGlbs: React.Dispatch<React.SetStateAction<string[]>>
  phase: Phase
  hidden: boolean
  circleFacing: 'camera' | 'normal'; setCircleFacing: (v: 'camera' | 'normal') => void
  studentVertexSettings: Record<string, VertexSettings>; updateStudentVS: (name: string, updates: Partial<VertexSettings>) => void
  onCapture?: () => void
  onRecord?: () => void
  isRecording?: boolean
}) {
  const set = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) =>
    setAdmin(prev => ({ ...prev, [key]: value }))
  const {
    audioVolume, timebombActive,
    showFigure, figureRadius, figureSpeed, figureX, figureY, figureZ, figureScale, figureFacing,
    figureWireframe, wireframeStyle, dotSize, circleDotSize, circleDotSizeMobile, circleShowImages, dotColor, dotCount, circleDotCountMobile,
    meshTexture, texScale, texOffsetX, texOffsetY, texRotation, showVertexImages,
    figureRings, figureDrift,
    soloReact, circleRadius, circleFigureFacing, circleFigureY, circleCameraMode, circleCamX, circleCamY, circleCamZ, circleCamXM, circleCamYM, circleCamZM, circleCamZoomM, circleFigureYM,
    circleCamFov, circleCamZoom, circleCamXLoop, circleCamXLoopSpeed, camX, camY, camZ,
    roomCameraMode, roomCamFov, roomCamZoom, roomCamXLoop, roomCamXLoopSpeed, nutsaGlbScale, nutsaGlbRepeat,
  } = admin
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadStudent, setUploadStudent] = useState<string>(STUDENTS[0])
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  async function doUpload() {
    if (!uploadFiles.length || !uploadStudent) return
    setUploadProgress({ done: 0, total: uploadFiles.length })
    setUploadError(null)
    for (let i = 0; i < uploadFiles.length; i++) {
      try {
        await onAdminUpload(uploadFiles[i], uploadStudent)
        setUploadProgress({ done: i + 1, total: uploadFiles.length })
      } catch (e) { setUploadError(String(e)); break }
    }
    setUploadFiles([])
  }
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 280, zIndex: 100,
      background: P.surface, borderLeft: `1px solid ${P.border}`,
      overflowY: 'auto', fontFamily: P.font, userSelect: 'none',
      display: hidden ? 'none' : undefined,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${P.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 3, color: P.text }}>REPLY.</div>
          <div style={{ fontSize: 9, color: P.dim, letterSpacing: 1.5, marginTop: 2 }}>LIVE EDITOR</div>
        </div>
        <div style={{
          fontSize: 9, letterSpacing: 1, padding: '3px 7px',
          border: `1px solid ${P.border}`, color: P.dim,
        }}>
          {phase.toUpperCase()}
        </div>
      </div>

      <PanelSection title="View">
        <PanelToggle
          options={[{ label: 'Globe', value: 'globe' }, { label: 'Room', value: 'room' }, { label: 'Circle', value: 'circle' }]}
          value={viewMode}
          onChange={v => setViewMode(v as 'globe' | 'room' | 'circle')}
        />
      </PanelSection>

      <PanelSection title="Audio">
        <PanelSlider label="Volume" value={audioVolume} min={0} max={1} step={0.01} decimals={2} onChange={v => set('audioVolume', v)} />
      </PanelSection>

      <PanelSection title="Timebomb">
        <PanelToggle
          options={[{ label: 'Armed', value: 'on' }, { label: 'Safe', value: 'off' }]}
          value={timebombActive ? 'on' : 'off'}
          onChange={v => set('timebombActive', v === 'on')}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: P.dim }}>
            {hiddenCount} image{hiddenCount !== 1 ? 's' : ''} hidden
          </span>
          <button
            onClick={resetTimebomb}
            style={{
              fontFamily: P.font, fontSize: 10, letterSpacing: 0.5,
              padding: '4px 10px', background: 'transparent',
              color: P.dim, border: `1px solid ${P.border}`, cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Figure">
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showFigure ? 'show' : 'hide'}
          onChange={v => set('showFigure', v === 'show')}
        />
        <PanelSlider label="Scale"      value={figureScale}  min={200}  max={500}  step={1}    decimals={0} onChange={v => set('figureScale', v)} />
        <PanelSlider label="Radius"     value={figureRadius} min={0.5}  max={200}  step={1}    decimals={1} onChange={v => set('figureRadius', v)} />
        <PanelSlider label="Speed"      value={figureSpeed}  min={0}    max={5}    step={0.05} decimals={2} onChange={v => set('figureSpeed', v)} />
        <PanelSlider label="Facing"     value={figureFacing} min={0}    max={6.28} step={0.05} decimals={2} onChange={v => set('figureFacing', v)} />
        <PanelToggle
          options={[{ label: 'Solid', value: 'solid' }, { label: 'Wireframe', value: 'wire' }]}
          value={figureWireframe ? 'wire' : 'solid'}
          onChange={v => set('figureWireframe', v === 'wire')}
        />
        {figureWireframe && (
          <>
            <PanelToggle
              options={[
                { label: 'Edges', value: 'edges' },
                { label: 'Dense', value: 'dense' },
                { label: 'Dash',  value: 'dashed' },
                { label: 'Dots',  value: 'points' },
              ]}
              value={wireframeStyle}
              onChange={v => set('wireframeStyle', v as WireframeStyle)}
            />
            {wireframeStyle === 'points' && (
              <>
                <PanelSlider label="Dot count" value={dotCount} min={100} max={50000} step={100} decimals={0} onChange={v => set('dotCount', v)} />
                <PanelSlider label="Dot size"  value={dotSize}  min={0.001} max={1} step={0.001} decimals={3} onChange={v => set('dotSize', v)} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 8px' }}>
                  <span style={{ fontSize: 11, color: P.dim }}>Dot color</span>
                  <input
                    type="color"
                    value={dotColor}
                    onChange={e => set('dotColor', e.target.value)}
                    style={{ width: 32, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                  />
                </div>
              </>
            )}
          </>
        )}
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Image drift</div>
        <PanelToggle
          options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
          value={figureDrift ? 'on' : 'off'}
          onChange={v => set('figureDrift', v === 'on')}
        />
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Sergi rings</div>
        <PanelToggle
          options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
          value={figureRings ? 'on' : 'off'}
          onChange={v => set('figureRings', v === 'on')}
        />
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Solo react</div>
        <PanelToggle
          options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
          value={soloReact ? 'on' : 'off'}
          onChange={v => set('soloReact', v === 'on')}
        />
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Vertex images</div>
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showVertexImages ? 'show' : 'hide'}
          onChange={v => set('showVertexImages', v === 'show')}
        />
        <PanelSlider label="Image size"       value={vertexImgSize}      min={0.005} max={3}  step={0.005} decimals={3} onChange={setVertexImgSize} />
        <PanelSlider label="Image repeat"     value={vertexRepeat}       min={1}     max={50} step={1}     decimals={0} onChange={setVertexRepeat} />
        <PanelSlider label="Audio image size" value={vertexAudioImgSize} min={0.005} max={3}  step={0.005} decimals={3} onChange={setVertexAudioImgSize} />
        <PanelSlider label="Audio repeat"     value={vertexAudioRepeat}  min={1}     max={50} step={1}     decimals={0} onChange={setVertexAudioRepeat} />
      </PanelSection>

      {viewMode === 'circle' && (
        <PanelSection title="Circle — Camera">
          <PanelToggle
            options={[{ label: 'Perspective', value: 'perspective' }, { label: 'Ortho', value: 'orthographic' }, { label: 'Panoramic', value: 'panoramic' }]}
            value={circleCameraMode}
            onChange={v => {
              const mode = v as CircleCameraMode
              setAdmin(prev => ({
                ...prev,
                circleCameraMode: mode,
                ...(mode === 'panoramic' ? { circleCamFov: 150 } : mode === 'perspective' ? { circleCamFov: 60 } : {}),
              }))
            }}
          />
          <PanelSlider label="Cam X"     value={circleCamX}      min={-2000} max={2000} step={10}  decimals={0} onChange={v => set('circleCamX', v)} />
          <PanelSlider label="Cam Y"     value={circleCamY}      min={-500}  max={2000} step={10}  decimals={0} onChange={v => set('circleCamY', v)} />
          <PanelSlider label="Cam Z"     value={circleCamZ}      min={-2000} max={2000} step={10}  decimals={0} onChange={v => set('circleCamZ', v)} />
          {circleCameraMode !== 'orthographic' && (
            <PanelSlider label="FOV"     value={circleCamFov}    min={10} max={175} step={1} decimals={0} onChange={v => set('circleCamFov', v)} />
          )}
          {circleCameraMode === 'orthographic' && (
            <PanelSlider label="Zoom"    value={circleCamZoom}   min={0.1} max={10} step={0.1} decimals={1} onChange={v => set('circleCamZoom', v)} />
          )}
          <div style={{ fontSize: 11, color: P.dim, marginBottom: 8, marginTop: 4 }}>Mobile offsets (&lt;1000px)</div>
          <PanelSlider label="Cam X M"  value={circleCamXM}    min={-1000} max={1000} step={10}   decimals={0} onChange={v => set('circleCamXM', v)} />
          <PanelSlider label="Cam Y M"  value={circleCamYM}    min={-1000} max={1000} step={10}   decimals={0} onChange={v => set('circleCamYM', v)} />
          <PanelSlider label="Cam Z M"  value={circleCamZM}    min={-1000} max={1000} step={10}   decimals={0} onChange={v => set('circleCamZM', v)} />
          <PanelSlider label="Zoom M"   value={circleCamZoomM} min={-1.5}  max={1.5}  step={0.01} decimals={2} onChange={v => set('circleCamZoomM', v)} />
          <PanelSlider label="Figure Y M" value={circleFigureYM} min={-500} max={500} step={1}    decimals={0} onChange={v => set('circleFigureYM', v)} />
          <div style={{ fontSize: 11, color: P.dim, marginBottom: 8, marginTop: 4 }}>Cam X loop</div>
          <PanelToggle
            options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
            value={circleCamXLoop ? 'on' : 'off'}
            onChange={v => set('circleCamXLoop', v === 'on')}
          />
          {circleCamXLoop && (
            <PanelSlider label="Speed"   value={circleCamXLoopSpeed} min={0.1} max={10} step={0.1} decimals={1} onChange={v => set('circleCamXLoopSpeed', v)} />
          )}
          <PanelSlider label="Circle R"  value={circleRadius}      min={100}  max={1500} step={10}   decimals={0}  onChange={v => set('circleRadius', v)} />
          <PanelSlider label="Facing"    value={circleFigureFacing} min={0}    max={6.28} step={0.05} decimals={2}  onChange={v => set('circleFigureFacing', v)} />
          <PanelSlider label="Figure Y"  value={circleFigureY}     min={-500} max={500}  step={1}    decimals={0}  onChange={v => set('circleFigureY', v)} />
          <PanelSlider label="Dot size"  value={circleDotSize}   min={0.001} max={1}   step={0.001} decimals={3} onChange={v => set('circleDotSize', v)} />
          <PanelSlider label="Dot size M" value={circleDotSizeMobile} min={0.001} max={2} step={0.001} decimals={3} onChange={v => set('circleDotSizeMobile', v)} />
          <PanelSlider label="Dot count M" value={circleDotCountMobile} min={100} max={50000} step={100} decimals={0} onChange={v => set('circleDotCountMobile', v)} />
          <div style={{ fontSize: 11, color: P.dim, marginBottom: 8, marginTop: 4 }}>Student images</div>
          <PanelToggle
            options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
            value={circleShowImages ? 'show' : 'hide'}
            onChange={v => set('circleShowImages', v === 'show')}
          />
          <div style={{ fontSize: 11, color: P.dim, marginBottom: 6, marginTop: 10 }}>Facing</div>
          <PanelToggle
            options={[{ label: 'Camera', value: 'camera' }, { label: 'Surface', value: 'normal' }]}
            value={circleFacing}
            onChange={v => setCircleFacing(v as 'camera' | 'normal')}
          />
          {circleCameraInfoRef && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: P.dim, marginBottom: 6 }}>Live camera</div>
              <div ref={circleCameraInfoRef} style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: P.text, lineHeight: 1.9 }} />
            </div>
          )}
        </PanelSection>
      )}

      <PanelSection title="Mesh texture">
        {meshTexture ? (
          <div style={{ marginBottom: 10 }}>
            <img src={meshTexture} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block', marginBottom: 8 }} />
            <button
              onClick={() => { URL.revokeObjectURL(meshTexture as string); set('meshTexture', null) }}
              style={{
                fontFamily: P.font, fontSize: 10, letterSpacing: 0.5, width: '100%',
                padding: '5px 0', background: 'transparent', color: P.dim,
                border: `1px solid ${P.border}`, cursor: 'pointer',
              }}
            >
              Remove texture
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: P.low, marginBottom: 10 }}>No texture applied</div>
        )}
        {meshTexture && (<>
          <PanelSlider label="Scale"    value={texScale}   min={0.1} max={5}  step={0.05} decimals={2} onChange={v => set('texScale', v)} />
          <PanelSlider label="Offset X" value={texOffsetX} min={-1}  max={1}  step={0.01} decimals={2} onChange={v => set('texOffsetX', v)} />
          <PanelSlider label="Offset Y" value={texOffsetY} min={-1}  max={1}  step={0.01} decimals={2} onChange={v => set('texOffsetY', v)} />
          <PanelSlider label="Rotation" value={texRotation} min={0}  max={360} step={1}   decimals={0} onChange={v => set('texRotation', v)} />
        </>)}
        <label style={{
          display: 'block', fontFamily: P.font, fontSize: 10, letterSpacing: 0.5,
          padding: '7px 0', textAlign: 'center' as const,
          border: `1px solid ${P.border}`, color: P.dim, cursor: 'pointer',
        }}>
          {meshTexture ? 'Replace image' : 'Upload image'}
          <input
            type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              if (meshTexture) URL.revokeObjectURL(meshTexture)
              set('meshTexture', URL.createObjectURL(file))
              e.target.value = ''
            }}
          />
        </label>
      </PanelSection>

      <PanelSection title="Student textures">
        {STUDENTS.filter(s => s !== 'SELF').map(name => {
          const tex = studentTextures[name] ?? null
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              {tex && <img src={tex} style={{ width: 22, height: 22, objectFit: 'cover', flexShrink: 0 }} />}
              <span style={{ fontSize: 10, color: P.dim, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name.split(' ')[0]}
              </span>
              {tex ? (
                <button
                  onClick={() => { URL.revokeObjectURL(tex); setStudentTextures(prev => { const n = { ...prev }; delete n[name]; return n }) }}
                  style={{ fontFamily: P.font, fontSize: 10, padding: '1px 6px', background: 'transparent', border: `1px solid ${P.border}`, color: P.dim, cursor: 'pointer', flexShrink: 0 }}
                >×</button>
              ) : (
                <label style={{ fontFamily: P.font, fontSize: 10, padding: '1px 6px', border: `1px solid ${P.border}`, color: P.low, cursor: 'pointer', flexShrink: 0 }}>
                  +
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setStudentTextures(prev => ({ ...prev, [name]: URL.createObjectURL(file) }))
                    e.target.value = ''
                  }} />
                </label>
              )}
            </div>
          )
        })}
      </PanelSection>

      <PanelSection title="Student drift">
        {STUDENTS.filter(s => s !== 'SELF').map(name => {
          const vs = studentVertexSettings[name] ?? {}
          const enabled = vs.driftEnabled !== false
          const speed = vs.driftSpeed ?? 1
          const amp   = vs.driftAmp   ?? 0.5
          return (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: enabled ? P.dim : P.low, flex: 1 }}>{name.split(' ')[0]}</span>
                <button
                  onClick={() => updateStudentVS(name, { driftEnabled: !enabled })}
                  style={{
                    fontFamily: P.font, fontSize: 9, letterSpacing: 0.5, padding: '2px 7px',
                    background: enabled ? P.accent : 'transparent',
                    color: enabled ? '#000' : P.low,
                    border: `1px solid ${enabled ? P.accent : P.border}`,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >{enabled ? 'on' : 'off'}</button>
              </div>
              {enabled && (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: P.low, width: 36, flexShrink: 0 }}>speed</span>
                  <input type="range" min={0} max={3} step={0.05} value={speed}
                    onChange={e => updateStudentVS(name, { driftSpeed: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: P.accent, cursor: 'pointer' }} />
                  <span style={{ fontSize: 9, color: P.text, width: 28, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }}>{speed.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: P.low, width: 36, flexShrink: 0 }}>dist</span>
                  <input type="range" min={0} max={3} step={0.05} value={amp}
                    onChange={e => updateStudentVS(name, { driftAmp: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: P.accent, cursor: 'pointer' }} />
                  <span style={{ fontSize: 9, color: P.text, width: 28, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }}>{amp.toFixed(2)}</span>
                </div>
              </>)}
            </div>
          )
        })}
      </PanelSection>

      {(viewMode === 'room' || viewMode === 'self') && (
        <PanelSection title="Room — Camera">
          <PanelToggle
            options={[{ label: 'Free', value: 'freeroam' }, { label: 'Persp', value: 'perspective' }, { label: 'Ortho', value: 'orthographic' }, { label: 'Pano', value: 'panoramic' }]}
            value={roomCameraMode}
            onChange={v => set('roomCameraMode', v as RoomCameraMode)}
          />
          <PanelSlider label="Cam X"    value={camX}  min={-2000} max={2000} step={10}  decimals={0} onChange={v => set('camX', v)} />
          <PanelSlider label="Cam Y"    value={camY}  min={-500}  max={2000} step={10}  decimals={0} onChange={v => set('camY', v)} />
          <PanelSlider label="Cam Z"    value={camZ}  min={-2000} max={2000} step={10}  decimals={0} onChange={v => set('camZ', v)} />
          {roomCameraMode === 'orthographic' && (
            <PanelSlider label="Zoom"   value={roomCamZoom} min={0.1} max={10} step={0.1} decimals={1} onChange={v => set('roomCamZoom', v)} />
          )}
          {roomCameraMode !== 'orthographic' && roomCameraMode !== 'freeroam' && (
            <PanelSlider label="FOV"    value={roomCamFov}  min={10} max={175} step={1}  decimals={0} onChange={v => set('roomCamFov', v)} />
          )}
          {roomCameraMode !== 'freeroam' && (<>
            <div style={{ fontSize: 11, color: P.dim, marginBottom: 8, marginTop: 4 }}>Cam X loop</div>
            <PanelToggle
              options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
              value={roomCamXLoop ? 'on' : 'off'}
              onChange={v => set('roomCamXLoop', v === 'on')}
            />
            {roomCamXLoop && (
              <PanelSlider label="Speed" value={roomCamXLoopSpeed} min={0.1} max={10} step={0.1} decimals={1} onChange={v => set('roomCamXLoopSpeed', v)} />
            )}
          </>)}
          <PanelSlider label="Figure X" value={figureX} min={-200} max={200} step={2}  decimals={0} onChange={v => set('figureX', v)} />
          <PanelSlider label="Figure Y" value={figureY} min={-500} max={500} step={1}  decimals={0} onChange={v => set('figureY', v)} />
          <PanelSlider label="Figure Z" value={figureZ} min={-100} max={100} step={2}  decimals={0} onChange={v => set('figureZ', v)} />
        </PanelSection>
      )}


      {viewMode === 'room' && (
        <PanelSection title="Nutsa — GLB models">
          <label style={{ display: 'block', cursor: 'pointer', background: P.surface, border: `1px solid ${P.border}`, padding: '5px 10px', fontSize: 10, color: P.dim, marginBottom: 8, textAlign: 'center' as const }}>
            + add .glb files
            <input type="file" accept=".glb" multiple style={{ display: 'none' }} onChange={e => {
              const urls = Array.from(e.target.files ?? []).map(f => URL.createObjectURL(f))
              setNutsaGlbs(p => [...p, ...urls])
              e.target.value = ''
            }} />
          </label>
          <PanelSlider label="scale" value={nutsaGlbScale} min={0.001} max={0.5} step={0.001} decimals={3} onChange={v => set('nutsaGlbScale', v)} />
          <PanelSlider label="repeat" value={nutsaGlbRepeat} min={1} max={200} step={1} decimals={0} onChange={v => set('nutsaGlbRepeat', v)} />
          {nutsaGlbs.length === 0 && (
            <div style={{ fontSize: 10, color: P.low, marginBottom: 8 }}>no models — using images</div>
          )}
          {nutsaGlbs.map((url, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: P.dim }}>model {i + 1}</span>
              <button onClick={() => setNutsaGlbs(p => p.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: P.low, padding: 0 }}>
                remove
              </button>
            </div>
          ))}
          {nutsaGlbs.length > 0 && (
            <button onClick={() => setNutsaGlbs([])}
              style={{ width: '100%', fontFamily: P.font, fontSize: 10, padding: '4px 0', cursor: 'pointer', background: P.surface, color: P.low, border: `1px solid ${P.border}`, marginTop: 4 }}>
              clear all
            </button>
          )}
        </PanelSection>
      )}

      {(viewMode === 'room') && onCapture && (
        <PanelSection title="Export">
          <button
            onClick={onCapture}
            style={{ width: '100%', fontFamily: P.font, fontSize: 10, padding: '6px 0', cursor: 'pointer', background: P.surface, color: P.text, border: `1px solid ${P.border}`, letterSpacing: 1 }}
          >
            SAVE 16-BIT PNG
          </button>
        </PanelSection>
      )}

      {(viewMode === 'circle') && onRecord && (
        <PanelSection title="Export">
          <button
            onClick={onRecord}
            style={{
              width: '100%', fontFamily: P.font, fontSize: 10, padding: '6px 0', cursor: 'pointer', letterSpacing: 1,
              background: isRecording ? 'rgba(200,0,0,0.08)' : P.surface,
              color: isRecording ? 'rgba(200,0,0,0.8)' : P.text,
              border: `1px solid ${isRecording ? 'rgba(200,0,0,0.5)' : P.border}`,
            }}
          >
            {isRecording ? '● STOP REC' : 'RECORD VIDEO'}
          </button>
        </PanelSection>
      )}

      <PanelSection title="About">
        <div style={{ fontSize: 10, color: P.low, lineHeight: 1.7 }}>
          <strong style={{ color: P.dim }}>URL</strong> ?admin=true<br />
          <strong style={{ color: P.dim }}>Stack</strong> Next.js · Three.js · Supabase<br />
          <strong style={{ color: P.dim }}>Repo</strong> Prangishvili/reply-gallery
        </div>
      </PanelSection>
    </div>
  )
}

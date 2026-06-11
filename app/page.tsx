'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { Post } from '@/lib/supabase'

const GlobeCanvas  = dynamic(() => import('./globe'), { ssr: false })
const RoomCanvas   = dynamic(() => import('./room'),  { ssr: false })
const CircleCanvas = dynamic(() => import('./room').then(m => ({ default: m.CircleCanvas })), { ssr: false })
const SelfCanvas   = dynamic(() => import('./room').then(m => ({ default: m.SelfCanvas   })), { ssr: false })
import type { WireframeStyle, CircleCameraMode, RoomCameraMode, TextureMapping } from './room'

const STUDENTS = ['Mariam Wulaia','Nodar Gogichaishvili','Sesili Gurgenidze','Dominika Davshrishovi','Salome Shalvashvili','Nutsa Kavtelishvili','Ketevan Lomiashvili','Mariam Qsovreli','Ana Mamniashvili','Bako Shengelia','Sergi Sarajevi','Natali Chixelidze']

// ── Per-student image size & repeat defaults — edit values here ───────────────
// imgSize / repeat           → used when no audio is playing
// audioImgSize / audioRepeat → used when audio is playing (omit to keep same as static)
// facing: 'normal'           → images lie flat on the mesh surface
// facing: 'camera'           → images always face the camera (old billboard behaviour)
type VertexSettings = { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal' }
const STUDENT_VERTEX_DEFAULTS: Record<string, VertexSettings> = {
  'Nodar Gogichaishvili':  { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1 },
  'Sesili Gurgenidze':     { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1 },
  'Dominika Davshrishovi': { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1 },
  'Nutsa Kavtelishvili':   { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1 },
  'Ketevan Lomiashvili':   { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1 },
  'Ana Mamniashvili':      { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1 },
  'Sergi Sarajevi':        { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1 },
  'Natali Chixelidze':     { imgSize: 0.025, repeat: 1, audioImgSize: 0.025, audioRepeat: 1 },
  'Salome Shalvashvili':   { imgSize: 0.060, repeat: 17, audioImgSize: 0.060, audioRepeat: 17, facing: 'camera' },
  'Bako Shengelia':        { imgSize: 0.090, repeat: 30, audioImgSize: 0.090, audioRepeat: 17, facing: 'normal' },
  'Mariam Wulaia':         { imgSize: 0.070, repeat: 5, audioImgSize: 0.050, audioRepeat: 5, facing: 'camera'},
  'Mariam Qsovreli':       { imgSize: 0.120, repeat: 19, audioImgSize: 0.090, audioRepeat: 15, facing: 'normal' },
}

type ImageItem = { file: File; preview: string; caption: string }

function fileToCaption(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}

type Phase = 'entry' | 'gallery'

// ─── Admin settings ───────────────────────────────────────────────────────────

type AdminSettings = {
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
  soloReact: boolean
  circleRadius: number
  circleFigureY: number
  circleCameraMode: CircleCameraMode
  circleCamX: number
  circleCamY: number
  circleCamZ: number
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

const ADMIN_DEFAULTS: AdminSettings = {
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
  figureRings: false,
  soloReact: false,
  circleRadius: 340,
  circleFigureY: 200,
  circleCameraMode: 'orthographic',
  circleCamX: 150,
  circleCamY: 4000,
  circleCamZ: -1350,
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

const P = {
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

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
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

function PanelSlider({ label, value, min, max, step, decimals = 0, onChange }: {
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

function PanelToggle({ options, value, onChange }: {
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

function AdminPanel({
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
}) {
  const set = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) =>
    setAdmin(prev => ({ ...prev, [key]: value }))
  const {
    audioVolume, timebombActive,
    showFigure, figureRadius, figureSpeed, figureX, figureY, figureZ, figureScale, figureFacing,
    figureWireframe, wireframeStyle, dotSize, circleDotSize, circleDotSizeMobile, circleShowImages, dotColor, dotCount, circleDotCountMobile,
    meshTexture, texScale, texOffsetX, texOffsetY, texRotation, showVertexImages,
    figureRings,
    soloReact, circleRadius, circleFigureY, circleCameraMode, circleCamX, circleCamY, circleCamZ,
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
          <div style={{ fontSize: 11, color: P.dim, marginBottom: 8, marginTop: 4 }}>Cam X loop</div>
          <PanelToggle
            options={[{ label: 'On', value: 'on' }, { label: 'Off', value: 'off' }]}
            value={circleCamXLoop ? 'on' : 'off'}
            onChange={v => set('circleCamXLoop', v === 'on')}
          />
          {circleCamXLoop && (
            <PanelSlider label="Speed"   value={circleCamXLoopSpeed} min={0.1} max={10} step={0.1} decimals={1} onChange={v => set('circleCamXLoopSpeed', v)} />
          )}
          <PanelSlider label="Circle R"  value={circleRadius}    min={100}  max={1500} step={10}  decimals={0} onChange={v => set('circleRadius', v)} />
          <PanelSlider label="Figure Y"  value={circleFigureY}   min={-500} max={500}  step={1}   decimals={0} onChange={v => set('circleFigureY', v)} />
          <PanelSlider label="Dot size"  value={circleDotSize}   min={0.001} max={1}   step={0.001} decimals={3} onChange={v => set('circleDotSize', v)} />
          <PanelSlider label="Dot size M" value={circleDotSizeMobile} min={0.001} max={2} step={0.001} decimals={3} onChange={v => set('circleDotSizeMobile', v)} />
          <PanelSlider label="Dot count M" value={circleDotCountMobile} min={100} max={50000} step={100} decimals={0} onChange={v => set('circleDotCountMobile', v)} />
          <div style={{ fontSize: 11, color: P.dim, marginBottom: 8, marginTop: 4 }}>Student images</div>
          <PanelToggle
            options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
            value={circleShowImages ? 'show' : 'hide'}
            onChange={v => set('circleShowImages', v === 'show')}
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

      <PanelSection title="Upload to DB">
        <select value={uploadStudent} onChange={e => setUploadStudent(e.target.value)}
          style={{ width: '100%', marginBottom: 8, fontFamily: P.font, fontSize: 10, background: P.surface, color: P.text, border: `1px solid ${P.border}`, padding: '4px 6px' }}>
          {STUDENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: 'block', cursor: 'pointer', background: P.surface, border: `1px solid ${P.border}`, padding: '5px 10px', fontSize: 10, color: P.dim, marginBottom: 8, textAlign: 'center' as const }}>
          {uploadFiles.length ? `${uploadFiles.length} file${uploadFiles.length > 1 ? 's' : ''} selected` : 'choose files'}
          <input type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={e => { setUploadFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        </label>
        <button onClick={doUpload} disabled={!uploadFiles.length || !!uploadProgress}
          style={{ width: '100%', fontFamily: P.font, fontSize: 10, padding: '5px 0', cursor: 'pointer', background: P.surface, color: P.text, border: `1px solid ${P.border}` }}>
          {uploadProgress ? `uploading ${uploadProgress.done}/${uploadProgress.total}…` : 'upload'}
        </button>
        {uploadError && <div style={{ marginTop: 6, fontSize: 10, color: '#f55' }}>{uploadError}</div>}
      </PanelSection>

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

// ─── Main app ─────────────────────────────────────────────────────────────────

function HomeInner() {
  const [phase, setPhase] = useState<Phase>('entry')
  const [withSound, setWithSound] = useState(true)
  const [showQuote, setShowQuote] = useState(false)
  const [replyFrame, setReplyFrame] = useState(0)
  useEffect(() => {
    if (phase !== 'entry') return
    const id = setInterval(() => setReplyFrame(f => (f + 1) % 3), 250)
    return () => clearInterval(id)
  }, [phase])
  const cursorWrapRef = useRef<HTMLDivElement>(null)
  const cursorDotRef  = useRef<HTMLElement>(null)

  useEffect(() => {
    const wrap = cursorWrapRef.current
    const dot  = cursorDotRef.current
    if (!wrap || !dot) return
    const onMove = (e: MouseEvent) => {
      wrap.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
      const el = e.target as Element
      const isPointer = !!el.closest('button, a, input, label, select, textarea, [role="button"]')
      dot.style.transform = `translate(-50%, -50%) scale(${isPointer ? 1.8 : 1})`
    }
    const onLeave = () => { wrap.style.transform = 'translate(-100px, -100px)' }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    // Override any JS cursor changes (e.g. Three.js / OrbitControls)
    const observer = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>('canvas, [style*="cursor"]').forEach(el => {
        if (el.style.cursor && el.style.cursor !== 'none') el.style.cursor = 'none'
      })
    })
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] })
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      observer.disconnect()
    }
  }, [])

  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const bgAudioBlobRef = useRef<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const soundInputRef = useRef<HTMLInputElement>(null)

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [items, setItems] = useState<ImageItem[]>([])
  const [uploadStudentName, setUploadStudentName] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [roomKey, setRoomKey] = useState(0)

  const [admin, setAdmin] = useState<AdminSettings>(ADMIN_DEFAULTS)
  const {
    audioVolume, timebombActive,
    showFigure, figureRadius, figureSpeed, figureX, figureY, figureZ, figureScale, figureFacing,
    figureWireframe, wireframeStyle, dotSize, circleDotSize, circleDotSizeMobile, circleShowImages, dotColor, dotCount, circleDotCountMobile,
    meshTexture, texScale, texOffsetX, texOffsetY, texRotation, showVertexImages,
    figureRings,
    soloReact, circleRadius, circleFigureY, circleCameraMode, circleCamX, circleCamY, circleCamZ,
    circleCamFov, circleCamZoom, circleCamXLoop, circleCamXLoopSpeed, camX, camY, camZ,
    roomCameraMode, roomCamFov, roomCamZoom, roomCamXLoop, roomCamXLoopSpeed, nutsaGlbScale, nutsaGlbRepeat,
  } = admin

  const [showNames, setShowNames] = useState(true)
  const [nameSize, setNameSize] = useState(10)
  const [showNoiseGlobe, setShowNoiseGlobe] = useState(false)
  const [noiseColor1, setNoiseColor1] = useState('#08003a')
  const [noiseColor2, setNoiseColor2] = useState('#8c1aff')
  const [noiseSpeed, setNoiseSpeed] = useState(0.5)
  const [noiseScale, setNoiseScale] = useState(1.0)
  const [showWireframe, setShowWireframe] = useState(false)
  const [wireframeSegments, setWireframeSegments] = useState(16)
  const [wireframeOpacity, setWireframeOpacity] = useState(0.15)
  const [wireframeColor, setWireframeColor] = useState('#000000')
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [showAbout, setShowAbout] = useState(false)

  const [viewMode, setViewMode] = useState<'globe' | 'room' | 'circle' | 'self'>('circle')
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [personalRoomKey, setPersonalRoomKey] = useState(0)
  const [circleKey, setCircleKey] = useState(0)
  const [studentTextures, setStudentTextures] = useState<Record<string, string | null>>({})
  const [studentTextureMappings, setStudentTextureMappings] = useState<Record<string, TextureMapping>>({})
  const [activeEditStudent, setActiveEditStudent] = useState<string | null>(null)

  const handleCircleTextureUpload = (student: string, url: string | null) => {
    setStudentTextures(prev => {
      const old = prev[student]
      if (old?.startsWith('blob:')) URL.revokeObjectURL(old)
      return { ...prev, [student]: url }
    })
    if (url) setActiveEditStudent(student)
    else if (activeEditStudent === student) setActiveEditStudent(null)
  }

  const switchView = (v: 'globe' | 'room' | 'circle' | 'self') => {
    if (v === 'room') setRoomKey(k => k + 1)
    if (v === 'circle') setCircleKey(k => k + 1)
    setSelectedStudent(null)
    setViewMode(v)
  }

  const openStudentRoom = (name: string) => {
    setPersonalRoomKey(k => k + 1)
    setSelectedStudent(name)
  }

  const closeStudentRoom = () => {
    setSelectedStudent(null)
  }

  // Delay mounting the room/circle canvas so the GPU can release the globe context first
  const [mountedView, setMountedView] = useState<'globe' | 'room' | 'circle' | 'self'>('circle')
  useEffect(() => {
    if (viewMode === 'globe' || viewMode === 'self') { setMountedView(viewMode); return }
    const id = setTimeout(() => setMountedView(viewMode), 200)
    return () => clearTimeout(id)
  }, [viewMode])

  // Circle intro animation — show quote first, then animate (only once per session)
  const circleAnimRef = useRef<number | null>(null)
  const circleAnimPlayedRef = useRef(false)
  useEffect(() => {
    if (viewMode !== 'circle' || phase !== 'gallery') { setShowQuote(false); return }
    if (circleAnimPlayedRef.current) return
    circleAnimPlayedRef.current = true
    if (circleAnimRef.current !== null) cancelAnimationFrame(circleAnimRef.current)
    const fromCamY = circleCamYRef.current
    const fromZoom = circleCamZoomRef.current
    const fromFigY = circleFigureYRef.current
    const targetZoom = window.innerWidth < 1000 ? 0.6 : 1.8
    const duration = 4500
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const e = t
      setAdmin(prev => ({
        ...prev,
        circleCamY: fromCamY + (400 - fromCamY) * e,
        circleCamZoom: fromZoom + (targetZoom - fromZoom) * e,
        circleFigureY: fromFigY + (160 - fromFigY) * e,
      }))
      if (t < 1) circleAnimRef.current = requestAnimationFrame(tick)
      else { setAdmin(prev => ({ ...prev, circleCamXLoop: true, circleCamXLoopSpeed: 0.1 })); setTimeout(() => setShowQuote(false), 1000) }
    }
    setShowQuote(true)
    circleAnimRef.current = requestAnimationFrame(tick)
    return () => { if (circleAnimRef.current !== null) cancelAnimationFrame(circleAnimRef.current) }
  }, [viewMode, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Delay mounting personal room canvas too
  const [mountedStudent, setMountedStudent] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedStudent) { setMountedStudent(null); return }
    const id = setTimeout(() => setMountedStudent(selectedStudent), 200)
    return () => clearTimeout(id)
  }, [selectedStudent])

  const [showDoggo, setShowDoggo] = useState(false)
  const [doggoScale, setDoggoScale] = useState(40)
  const [doggoX, setDoggoX] = useState(0)
  const [doggoY, setDoggoY] = useState(0)
  const [doggoZ, setDoggoZ] = useState(0)

  // Refs so animation reads current values without stale closures
  const circleCamYRef = useRef(circleCamY)
  circleCamYRef.current = circleCamY
  const circleCamZoomRef = useRef(circleCamZoom)
  circleCamZoomRef.current = circleCamZoom
  const circleFigureYRef = useRef(circleFigureY)
  circleFigureYRef.current = circleFigureY

  const [studentVertexSettings, setStudentVertexSettings] = useState<Record<string, VertexSettings>>(() => ({ ...STUDENT_VERTEX_DEFAULTS }))
  const DEF_VS: VertexSettings = { imgSize: 0.025, repeat: 1 }
  const getVS = (name: string | null): VertexSettings => name ? (studentVertexSettings[name] ?? DEF_VS) : DEF_VS
  const setVSKey = (name: string | null, key: keyof VertexSettings, val: number) => {
    if (!name) return
    setStudentVertexSettings(p => ({ ...p, [name]: { ...(p[name] ?? DEF_VS), [key]: val } }))
  }
  const [graffitiMode, setGraffitiMode] = useState(false)
  const [graffitiColor, setGraffitiColor] = useState('#ff2222')
  const [graffitiBrushSize, setGraffitiBrushSize] = useState(8)
  const [graffitiClearKey, setGraffitiClearKey] = useState(0)
  const [transitionKey, setTransitionKey] = useState(0)
  const [selfStream, setSelfStream] = useState<MediaStream | null>(null)
  const [selfPermission, setSelfPermission] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [selfImgSize, setSelfImgSize] = useState(0.1)
  const [selfImgCount, setSelfImgCount] = useState(60)
  const [selfImages, setSelfImages] = useState<{ url: string; isVideo: boolean }[]>([])
  const selfImagesBlobsRef = useRef<string[]>([])
  const [selfFacing, setSelfFacing] = useState<'camera' | 'surface'>('camera')
  const [selfSoundReact, setSelfSoundReact] = useState(false)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImage, setBgImage] = useState<string | null>(null)
  const bgImageBlobRef = useRef<string | null>(null)
  const dissolveInitRef = useRef(false)
  const circleCameraInfoRef = useRef<HTMLDivElement>(null)
  const [nutsaGlbs, setNutsaGlbs] = useState<string[]>([])

  const [selectedStudents, setSelectedStudents] = useState<string[]>(['Salome Shalvashvili', 'Sergi Sarajevi'])
  const figureStudent  = selectedStudents[0] ?? null
  const figureStudent2 = selectedStudents[1] ?? null
  const figureOrbiting = selectedStudents.length === 2

  const handleStudentSelect = (name: string) => {
    if (name === 'SELF') {
      switchView(viewMode === 'self' ? 'room' : 'self')
      return
    }
    setSelectedStudents(prev => {
      const idx = prev.indexOf(name)
      if (idx !== -1) return prev.filter(s => s !== name)
      if (prev.length < 2) return [...prev, name]
      return [prev[1], name]
    })
  }

  // Increment transitionKey when student selection changes (skip first render)
  useEffect(() => {
    if (!dissolveInitRef.current) { dissolveInitRef.current = true; return }
    setTransitionKey(k => k + 1)
  }, [figureStudent, figureStudent2])

  // Stop webcam stream when leaving the SELF view
  useEffect(() => {
    if (viewMode !== 'self') {
      selfStream?.getTracks().forEach(t => t.stop())
      setSelfStream(null)
      setSelfPermission('idle')
    }
  }, [viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const [panelHidden, setPanelHidden] = useState(false)

  const isAdmin = useSearchParams().get('admin') === 'true'

  // H key toggles admin panel
  useEffect(() => {
    if (!isAdmin) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setPanelHidden(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAdmin])

  // Z key toggles sound on/off
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z') {
        const audio = bgAudioRef.current
        if (!audio) return
        if (audio.paused) {
          const ctx = audioCtxRef.current
          const resume = ctx && ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
          resume.then(() => audio.play()).catch(() => {})
        } else {
          audio.pause()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Sync audio volume live via gain node so analyser always sees full signal
  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = audioVolume
    else if (bgAudioRef.current) bgAudioRef.current.volume = audioVolume
  }, [audioVolume])

  // Timebomb: hide one random post every 2s, restore all when disarmed
  useEffect(() => {
    if (!timebombActive) { setHiddenIds(new Set()); return }
    const timer = setInterval(() => {
      setHiddenIds(prev => {
        const visible = posts.filter(p => !prev.has(p.id))
        if (visible.length === 0) return prev
        const pick = visible[Math.floor(Math.random() * visible.length)]
        return new Set([...prev, pick.id])
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [timebombActive, posts])



  function startBgAudio(sound: boolean) {
    const audio = new Audio('/fx_bg.mp3')
    audio.loop = true
    audio.volume = 1
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      const gain = ctx.createGain()
      gain.gain.value = sound ? audioVolume : 0
      source.connect(analyser)
      analyser.connect(gain)
      gain.connect(ctx.destination)
      analyserRef.current = analyser
      gainNodeRef.current = gain
      ctx.resume().catch(() => {})
    } catch {}
    audio.play().catch(() => {})
    bgAudioRef.current = audio
  }

  function replaceBgAudio(file: File) {
    const old = bgAudioRef.current
    bgAudioRef.current = null
    analyserRef.current = null
    if (old) { old.pause(); old.src = '' }
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null

    if (bgAudioBlobRef.current) URL.revokeObjectURL(bgAudioBlobRef.current)
    const url = URL.createObjectURL(file)
    bgAudioBlobRef.current = url
    const audio = new Audio(url)
    audio.loop = true
    audio.volume = 1
    setAdmin(prev => ({ ...prev, audioVolume: 1 }))
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyser.connect(ctx.destination)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      ctx.resume().catch(() => {})
    } catch {}
    audio.play().catch(() => {})
    bgAudioRef.current = audio
  }

  function goToGallery() {
    localStorage.setItem('reply_visited', 'true')
    setPhase('gallery')
  }

  // Preload the 3D chunks + figure GLB during the entry screen so the gallery
  // appears instantly when a sound option is clicked (images still load lazily)
  useEffect(() => {
    import('./room')
    import('./globe')
  }, [])

  useEffect(() => {
    const CACHE_KEY = 'reply_posts_cache'
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try { setPosts(JSON.parse(cached)); setLoading(false) } catch {}
    }
    fetch('/api/posts')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setPosts(data)
        setLoading(false)
        localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      })
  }, [])

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter(f => f.type.startsWith('image/'))
    setItems(prev => [
      ...prev,
      ...incoming.map(f => ({ file: f, preview: URL.createObjectURL(f), caption: fileToCaption(f) })),
    ])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateCaption(index: number, caption: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, caption } : item))
  }

  async function handleAdminUpload(file: File, studentName: string) {
    const fd = new FormData()
    fd.append('image', file)
    fd.append('text', file.name.replace(/\.[^.]+$/, ''))
    fd.append('student_name', studentName)
    const res = await fetch('/api/posts', { method: 'POST', body: fd })
    if (!res.ok) throw new Error(await res.text())
    const post: Post = await res.json()
    setPosts(p => [post, ...p])
  }

  async function handleDeletePost(id: string) {
    const post = posts.find(p => p.id === id)
    if (post?.image_url.startsWith('blob:')) {
      URL.revokeObjectURL(post.image_url)
    } else {
      await fetch(`/api/posts?id=${id}`, { method: 'DELETE' })
    }
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  function closeModal() {
    setShowUpload(false)
    setItems([])
    setUploadStudentName('')
    setError(null)
    setProgress(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { setError('Add at least one image.'); return }
    if (!uploadStudentName.trim()) { setError('Please select your name.'); return }
    setSubmitting(true)
    setError(null)

    const newPosts: Post[] = items.map(item => ({
      id: crypto.randomUUID(),
      text: item.caption.trim() || fileToCaption(item.file),
      image_url: item.preview,
      student_name: uploadStudentName.trim() || null,
      created_at: new Date().toISOString(),
    }))
    setPosts(p => [...newPosts.reverse(), ...p])
    closeModal()
    setSubmitting(false)
  }

  return (
    <div suppressHydrationWarning className="w-screen h-screen overflow-hidden relative" style={{ background: bgImage ? `url(${bgImage}) center/cover no-repeat` : bgColor }}>
      {/* Custom cursor */}
      <div ref={cursorWrapRef} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 99999, transform: 'translate(-100px, -100px)', willChange: 'transform' }}>
        <div ref={cursorDotRef as React.RefObject<HTMLDivElement>} style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff6600', transform: 'translate(-50%, -50%) scale(1)', transition: 'transform 0.12s ease' }} />
      </div>
      {/* Logo */}
      <div className="fixed top-9 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
        <img src="/logo.svg" alt="Reply" className="h-12 w-auto" fetchPriority="low" />
      </div>

      {/* View toggle */}
      {phase === 'gallery' && !loading && !selectedStudent && (
        <div
          className="fixed top-6 z-20"
          style={{ right: isAdmin && !panelHidden ? 296 : 16 }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            {(['room', 'circle', 'self'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => switchView(mode)}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
                  padding: 0, border: 'none', cursor: 'pointer', textTransform: 'uppercase',
                  background: 'transparent',
                  color: viewMode === mode ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.3)',
                  transition: 'color 0.15s',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Texture mapping overlay — circle view, after upload */}
      {mountedView === 'circle' && activeEditStudent && studentTextures[activeEditStudent] && (
        <div style={{
          position: 'fixed', right: 24, top: '50%', transform: 'translateY(-50%)',
          zIndex: 30, width: 160, display: 'flex', flexDirection: 'column', gap: 0,
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>
              {activeEditStudent.split(' ')[0]}
            </span>
            <button onClick={() => setActiveEditStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 12, color: 'rgba(0,0,0,0.3)', padding: 0, lineHeight: 1 }}>×</button>
          </div>
          {([
            { label: 'Scale',    key: 'scale',    min: 0.1, max: 5,   step: 0.05, dec: 2 },
            { label: 'Repeat',   key: 'repeat',   min: 1,   max: 20,  step: 1,    dec: 0 },
            { label: 'Offset X', key: 'offsetX',  min: -1,  max: 1,   step: 0.01, dec: 2 },
            { label: 'Offset Y', key: 'offsetY',  min: -1,  max: 1,   step: 0.01, dec: 2 },
            { label: 'Rotation', key: 'rotation', min: 0,   max: 360, step: 1,    dec: 0 },
          ] as { label: string; key: keyof TextureMapping; min: number; max: number; step: number; dec: number }[]).map(({ label, key, min, max, step, dec }) => {
            const val = (studentTextureMappings[activeEditStudent] ?? { scale: 1, repeat: 1, offsetX: 0, offsetY: 0, rotation: 0 })[key]
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.6)', fontVariantNumeric: 'tabular-nums' }}>{dec === 0 ? val : (val as number).toFixed(dec)}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => setStudentTextureMappings(prev => ({
                    ...prev,
                    [activeEditStudent]: { ...(prev[activeEditStudent] ?? { scale: 1, repeat: 1, offsetX: 0, offsetY: 0, rotation: 0 }), [key]: Number(e.target.value) }
                  }))}
                  style={{ width: '100%', accentColor: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Image controls overlay — room view */}
      {phase === 'gallery' && mountedView === 'room' && !selectedStudent && (
        <div style={{
          position: 'fixed', right: isAdmin && !panelHidden ? 296 + 24 : 24,
          top: '50%', transform: 'translateY(-50%)',
          zIndex: 30, width: 160, display: 'flex', flexDirection: 'column', gap: 0,
          pointerEvents: 'auto',
        }}>
          {posts.length > 0 && ([
            { label: 'Image size',       value: getVS(figureStudent).imgSize,       min: 0.005, max: 3,  step: 0.005, dec: 3, set: (v: number) => setVSKey(figureStudent, 'imgSize', v) },
            { label: 'Repeat',           value: getVS(figureStudent).repeat,         min: 1,     max: 20, step: 1,     dec: 0, set: (v: number) => setVSKey(figureStudent, 'repeat', v)  },
            { label: 'Audio image size', value: getVS(figureStudent).audioImgSize ?? getVS(figureStudent).imgSize, min: 0.005, max: 3,  step: 0.005, dec: 3, set: (v: number) => setVSKey(figureStudent, 'audioImgSize', v) },
            { label: 'Audio repeat',     value: getVS(figureStudent).audioRepeat  ?? getVS(figureStudent).repeat,  min: 1,     max: 20, step: 1,     dec: 0, set: (v: number) => setVSKey(figureStudent, 'audioRepeat', v)  },
          ] as { label: string; value: number; min: number; max: number; step: number; dec: number; set: (v: number) => void }[]).map(({ label, value, min, max, step, dec, set }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.6)', fontVariantNumeric: 'tabular-nums' }}>{dec === 0 ? value : value.toFixed(dec)}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => set(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
              />
            </div>
          ))}

          {/* Texture upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: posts.length > 0 ? 6 : 0 }}>
            {meshTexture && (
              <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
                <img src={meshTexture} style={{ width: 32, height: 32, objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => { URL.revokeObjectURL(meshTexture as string); setAdmin(prev => ({ ...prev, meshTexture: null })) }}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 13, height: 13, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 8, lineHeight: '13px', textAlign: 'center',
                  }}
                >×</button>
              </div>
            )}
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10,
                color: 'rgba(0,0,0,0.45)',
              }}>{meshTexture ? 'texture' : '+ texture'}</span>
              <input
                type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (meshTexture) URL.revokeObjectURL(meshTexture)
                  setAdmin(prev => ({ ...prev, meshTexture: URL.createObjectURL(file) }))
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {posts.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
              <button
                onClick={() => {
                  posts.filter(p => p.image_url.startsWith('blob:')).forEach(p => URL.revokeObjectURL(p.image_url))
                  setPosts(p => p.filter(post => !post.image_url.startsWith('blob:')))
                }}
                style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >remove all</button>
            </div>
          )}
        </div>
      )}

      {/* Image controls overlay — self view */}
      {phase === 'gallery' && mountedView === 'self' && selfPermission === 'granted' && !selectedStudent && (
        <div style={{
          position: 'fixed', right: isAdmin && !panelHidden ? 296 + 24 : 24,
          top: '50%', transform: 'translateY(-50%)',
          zIndex: 30, width: 160, display: 'flex', flexDirection: 'column', gap: 0,
          pointerEvents: 'auto',
        }}>
          {([
            { label: 'Image size', value: selfImgSize, min: 0.01, max: 1,   step: 0.005, dec: 3, set: setSelfImgSize  },
            { label: 'Count',      value: selfImgCount, min: 1,   max: 200,  step: 1,     dec: 0, set: setSelfImgCount },
          ] as { label: string; value: number; min: number; max: number; step: number; dec: number; set: (v: number) => void }[]).map(({ label, value, min, max, step, dec, set }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.7)', fontVariantNumeric: 'tabular-nums' }}>{dec === 0 ? value : value.toFixed(dec)}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => set(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'rgba(0,0,0,0.6)', cursor: 'pointer' }}
              />
            </div>
          ))}

          {/* Enable camera (shown when skipped) */}
          {!selfStream && (
            <button
              onClick={async () => {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
                  setSelfStream(stream)
                } catch {}
              }}
              style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: 'rgba(0,0,0,0.45)', display: 'block', marginBottom: 12,
              }}
            >enable camera</button>
          )}

          {/* Facing mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['camera', 'surface'] as const).map(mode => (
              <button key={mode} onClick={() => setSelfFacing(mode)} style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: selfFacing === mode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)',
                transition: 'color 0.15s',
              }}>{mode}</button>
            ))}
          </div>

          {/* Sound react toggle */}
          <button onClick={() => setSelfSoundReact(v => !v)} style={{
            fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: selfSoundReact ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)',
            transition: 'color 0.15s', display: 'block', marginBottom: 16,
          }}>sound react</button>

          {/* Uploaded media for mixing */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>mix media</span>
              {selfImages.length > 0 && (
                <button
                  onClick={() => {
                    selfImagesBlobsRef.current.forEach(u => URL.revokeObjectURL(u))
                    selfImagesBlobsRef.current = []
                    setSelfImages([])
                  }}
                  style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 9, color: 'rgba(0,0,0,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >clear all</button>
              )}
            </div>
            {selfImages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {selfImages.map(({ url, isVideo }) => (
                  <div key={url} style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                    {isVideo
                      ? <video src={url} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    }
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(url)
                        selfImagesBlobsRef.current = selfImagesBlobsRef.current.filter(u => u !== url)
                        setSelfImages(prev => prev.filter(item => item.url !== url))
                      }}
                      style={{
                        position: 'absolute', top: -5, right: -5,
                        width: 14, height: 14, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.75)', color: '#fff',
                        border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: 9, lineHeight: '14px', textAlign: 'center',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <input
              id="self-img-upload" type="file" multiple accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files || [])
                const newItems = files.map(f => {
                  const url = URL.createObjectURL(f)
                  selfImagesBlobsRef.current.push(url)
                  return { url, isVideo: f.type.startsWith('video/') }
                })
                setSelfImages(prev => [...prev, ...newItems])
                e.target.value = ''
              }}
            />
            <label
              htmlFor="self-img-upload"
              style={{
                display: 'block', textAlign: 'center', cursor: 'pointer',
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1,
                color: 'rgba(0,0,0,0.45)',
                border: '1px dashed rgba(0,0,0,0.2)',
                padding: '5px 0',
              }}
            >+ add files</label>
          </div>
        </div>
      )}


      {/* SELF — camera permission overlay */}
      {phase === 'gallery' && viewMode === 'self' && selfPermission !== 'granted' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 25,
          background: 'rgba(8,8,8,0.94)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 24,
          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase' }}>
            self
          </div>
          {selfPermission === 'idle' ? (
            <>
              <button
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
                    setSelfStream(stream)
                    setSelfPermission('granted')
                  } catch {
                    setSelfPermission('denied')
                  }
                }}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 2,
                  textTransform: 'uppercase', padding: '10px 28px',
                  background: 'transparent', color: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
                }}
              >
                enable camera
              </button>
              <button
                onClick={() => setSelfPermission('granted')}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                skip
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>
                camera access denied
              </div>
              <button
                onClick={() => setSelfPermission('idle')}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1,
                  padding: '6px 16px', background: 'transparent',
                  color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                }}
              >
                try again
              </button>
              <button
                onClick={() => setSelfPermission('granted')}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                skip
              </button>
            </>
          )}
        </div>
      )}

      {/* About button */}
      {phase === 'gallery' && !selectedStudent && (
        <button
          onClick={() => setShowAbout(v => !v)}
          style={{
            position: 'fixed', top: 24, left: 24, zIndex: 60,
            fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
            textTransform: 'uppercase', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: 0,
            color: showAbout ? 'rgb(0, 0, 0)' : 'rgb(0, 0, 0)',
            transition: 'color 0.15s',
          }}
        >
          about
        </button>
      )}

      {/* About overlay */}
      {showAbout && phase === 'gallery' && (
        <div
          onClick={() => setShowAbout(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '40px 24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="about-scroll"
            style={{ maxWidth: 720, width: '100%', maxHeight: '85vh', overflowY: 'auto', paddingRight: 28 }}
          >
            <p style={{
              fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2,
              color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em',
              whiteSpace: 'pre-line',
            }}>{`"The action of being is so revolutionary that society rejects it and concerns itself exclusively with the action of becoming."

— Jiddu Krishnamurti

Reply is a collaborative work by students of the Free University of Georgia, a meditation on digital identity, performed selfhood, and what gets lost in translation.

Every platform demands a different version of us. The visual self. The political self. The one who informs, the one who entertains. Collectively, they account for everything except the self that simply exists.

To push past this, each student developed their own writing system, a personal visual language designed not for legibility, but for honesty. Something to be felt rather than decoded.

Reply is a virtual art exhibition that abandons natural language as its framework, presenting each participant through a visual representation that resists performance and asks, instead, for presence.

Visitors are also invited to construct their own version, to reply, and in that act, to consider what genuine dialogue between selves might actually look like, to say what they truly feel, without being observed, evaluated, or judged. Only felt.`}</p>
            <img
              src="/credits.png"
              alt="Student signatures"
              style={{ width: '100%', maxWidth: 560, display: 'block', margin: '32px auto', mixBlendMode: 'multiply' }}
            />
            <p style={{
              fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2,
              color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em',
              whiteSpace: 'pre-line',
            }}>{`Students
Mariam Wulaia, Nodar Gogichaishvili, Sesili Gurgenidze, Dominika Davshrishovi, Salome Shalvashvili, Nutsa Kavtelishvili, Ketevan Lomiashvili, Mariam Qsovreli, Ana Mamniashvili, Bako Shengelia, Sergi Sarajevi, Natali Chixelidze

Lecturer
Oto Prangishvili

Free University of Georgia`}</p>
          </div>
        </div>
      )}

      {/* Uni logo */}
      <a
        href="https://www.freeuni.edu.ge/"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-20"
        style={isAdmin && !panelHidden ? { right: 286 } : {}}
      >
        <img src="/UNI.svg" alt="Free University of Tbilisi" className="h-10 w-auto" fetchPriority="low" />
      </a>

      {/* Student selector — left panel, room view only */}
      {phase === 'gallery' && mountedView === 'room' && !selectedStudent && (
        <div style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20,
          width: 160,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '32px 0',
          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
          overflowY: 'auto',
        }}>
          {STUDENTS.map(name => {
            const isSelf = name === 'SELF'
            const isSelected = isSelf ? viewMode === 'self' : selectedStudents.includes(name)
            return (
              <button
                key={name}
                onClick={() => handleStudentSelect(name)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '5px 16px',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 10, lineHeight: 1.4,
                  color: isSelected ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)',
                  transition: 'color 0.15s',
                }}>
                  {name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* View */}
      <div className="absolute inset-0" style={{
        ...(isAdmin && !panelHidden ? { right: 280 } : {}),
        filter: phase === 'entry' ? 'blur(42.5px)' : undefined,
      }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-gray-300 text-sm animate-pulse">loading…</span>
          </div>
        )}
        {!loading && mountedView === 'room' && !selectedStudent && (
          <RoomCanvas key={roomKey} posts={posts.filter(p => !hiddenIds.has(p.id))} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexSettings={studentVertexSettings} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} roomCameraMode={roomCameraMode} roomCamFov={roomCamFov} roomCamZoom={roomCamZoom} roomCamXLoop={roomCamXLoop} roomCamXLoopSpeed={roomCamXLoopSpeed} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} figureRings={figureRings} soloReact={soloReact} graffitiMode={graffitiMode} graffitiColor={graffitiColor} graffitiBrushSize={graffitiBrushSize} graffitiClearKey={graffitiClearKey} bgColor={bgColor} bgImage={bgImage} analyserRef={analyserRef} nutsaGlbs={nutsaGlbs} nutsaGlbScale={nutsaGlbScale} nutsaGlbRepeat={nutsaGlbRepeat} />
        )}
        {!loading && mountedView === 'circle' && !selectedStudent && (
          <CircleCanvas key={circleKey} posts={posts.filter(p => !hiddenIds.has(p.id))} students={STUDENTS.filter(s => s !== 'SELF')} circleRadius={circleRadius} figureScale={figureScale} figureY={circleFigureY} showVertexImages={circleShowImages} vertexSettings={studentVertexSettings} showWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={typeof window !== 'undefined' && window.innerWidth < 1000 ? circleDotSizeMobile : circleDotSize} dotColor={dotColor} dotCount={typeof window !== 'undefined' && window.innerWidth < 1000 ? circleDotCountMobile : dotCount} studentTextures={studentTextures} studentTextureMappings={studentTextureMappings} onTextureUpload={handleCircleTextureUpload} showNoiseGlobe={showNoiseGlobe} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} audioVolume={audioVolume} cameraMode={circleCameraMode} camX={circleCamX} camY={circleCamY} camZ={circleCamZ} camFov={circleCamFov} camZoom={circleCamZoom} camXLoop={circleCamXLoop} camXLoopSpeed={circleCamXLoopSpeed} bgColor={bgColor} bgImage={bgImage} analyserRef={analyserRef} cameraInfoRef={isAdmin ? circleCameraInfoRef : undefined} soloReact={false} isAdmin={isAdmin} />
        )}
        {!loading && posts.length > 0 && mountedView === 'globe' && !selectedStudent && (
          <GlobeCanvas
            posts={posts.filter(p => !hiddenIds.has(p.id))}
            showNames={showNames}
            nameSize={nameSize}
            showWireframe={showWireframe}
            wireframeSegments={wireframeSegments}
            wireframeOpacity={wireframeOpacity}
            wireframeColor={wireframeColor}
            showNoiseGlobe={showNoiseGlobe}
            audioVolume={audioVolume}
            analyserRef={analyserRef}
            noiseColor1={noiseColor1}
            noiseColor2={noiseColor2}
            noiseSpeed={noiseSpeed}
            noiseScale={noiseScale}
            blurNames={showAbout}
            onNameClick={openStudentRoom}
            namesClickable={phase === 'gallery'}
            bgColor={bgColor}
            bgImage={bgImage}
          />
        )}

        {/* SELF view */}
        {!loading && mountedView === 'self' && selfPermission === 'granted' && !selectedStudent && (
          <SelfCanvas stream={selfStream} figureScale={figureScale} figureFacing={figureFacing} imgSize={selfImgSize} imgCount={selfImgCount} bgColor={bgColor} bgImage={bgImage} images={selfImages} facing={selfFacing} analyserRef={selfSoundReact ? analyserRef : undefined} />
        )}

        {/* Personal student room */}
        {mountedStudent && (
          <RoomCanvas key={personalRoomKey} posts={posts.filter(p => p.student_name === mountedStudent)} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexSettings={studentVertexSettings} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} roomCameraMode={roomCameraMode} roomCamFov={roomCamFov} roomCamZoom={roomCamZoom} roomCamXLoop={roomCamXLoop} roomCamXLoopSpeed={roomCamXLoopSpeed} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} figureRings={figureRings} soloReact={soloReact} graffitiMode={graffitiMode} graffitiColor={graffitiColor} graffitiBrushSize={graffitiBrushSize} graffitiClearKey={graffitiClearKey} bgColor={bgColor} bgImage={bgImage} analyserRef={analyserRef} nutsaGlbs={nutsaGlbs} nutsaGlbScale={nutsaGlbScale} nutsaGlbRepeat={nutsaGlbRepeat} />
        )}
      </div>

      {/* Student room back button */}
      {selectedStudent && (
        <button
          onClick={closeStudentRoom}
          style={{
            position: 'fixed', top: 24, left: 24, zIndex: 60,
            fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
            textTransform: 'uppercase', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.7)',
            transition: 'color 0.15s',
          }}
        >
          ← back
        </button>
      )}

      {/* Student name label */}
      {selectedStudent && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 2,
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none',
        }}>
          {selectedStudent}
        </div>
      )}

      {/* Background controls */}
      {phase === 'gallery' && !selectedStudent && (
        <div style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
        }}>
          {/* Color swatch — click to open color picker */}
          <label style={{ cursor: 'pointer', position: 'relative' }} title="Background color">
            <div style={{
              width: 22, height: 22,
              background: bgColor,
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: 2,
            }} />
            <input
              type="color" value={bgColor}
              onChange={e => setBgColor(e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            />
          </label>
          {/* Upload background image */}
          <label style={{ cursor: 'pointer', fontSize: 10, color: 'rgba(0,0,0,0.4)', letterSpacing: 0.5, lineHeight: 1 }} title="Upload background image">
            bg
            <input
              type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                if (bgImageBlobRef.current) URL.revokeObjectURL(bgImageBlobRef.current)
                const url = URL.createObjectURL(file)
                bgImageBlobRef.current = url
                setBgImage(url)
                e.target.value = ''
              }}
            />
          </label>
          {bgImage && (
            <button
              onClick={() => {
                if (bgImageBlobRef.current) { URL.revokeObjectURL(bgImageBlobRef.current); bgImageBlobRef.current = null }
                setBgImage(null)
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'rgba(0,0,0,0.35)', lineHeight: 1 }}
            >×</button>
          )}
          {/* Upload post image */}
          <button
            onClick={() => setShowUpload(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: 'rgba(0,0,0,0.4)', letterSpacing: 0.5, lineHeight: 1, display: 'block' }}
            title="Upload post image"
          >img</button>
          {/* Upload background audio */}
          <label style={{ cursor: 'pointer', fontSize: 10, color: 'rgba(0,0,0,0.4)', letterSpacing: 0.5, lineHeight: 1 }} title="Replace background sound">
            mp3
            <input
              ref={soundInputRef}
              type="file" accept="audio/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) replaceBgAudio(e.target.files[0]); e.target.value = '' }}
            />
          </label>
        </div>
      )}

      {/* Intro quote overlay */}
      {phase === 'gallery' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          opacity: showQuote ? 1 : 0,
          transition: 'opacity 3.4s ease',
        }}>
          <p style={{
            width: '50%', textAlign: 'center',
            fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
            fontWeight: 300, fontSize: 18, lineHeight: 1.75,
            color: 'rgba(0, 0, 0, 0.85)', textTransform: 'uppercase',
          }}>
            The action of being is so revolutionary that society rejects it<br/>and concerns itself exclusively with the action of becoming.<br/>– Jiddu Krishnamurti
          </p>
        </div>
      )}

      {/* Admin panel */}
      {isAdmin && (
        <AdminPanel
          admin={admin} setAdmin={setAdmin}
          viewMode={viewMode} setViewMode={switchView}
          hiddenCount={hiddenIds.size} resetTimebomb={() => setHiddenIds(new Set())}
          vertexImgSize={getVS(figureStudent).imgSize} setVertexImgSize={v => setVSKey(figureStudent, 'imgSize', v)}
          vertexRepeat={getVS(figureStudent).repeat} setVertexRepeat={v => setVSKey(figureStudent, 'repeat', v)}
          vertexAudioImgSize={getVS(figureStudent).audioImgSize ?? getVS(figureStudent).imgSize} setVertexAudioImgSize={v => setVSKey(figureStudent, 'audioImgSize', v)}
          vertexAudioRepeat={getVS(figureStudent).audioRepeat ?? getVS(figureStudent).repeat} setVertexAudioRepeat={v => setVSKey(figureStudent, 'audioRepeat', v)}
          onAdminUpload={handleAdminUpload}
          circleCameraInfoRef={circleCameraInfoRef}
          studentTextures={studentTextures} setStudentTextures={setStudentTextures}
          nutsaGlbs={nutsaGlbs} setNutsaGlbs={setNutsaGlbs}
          hidden={panelHidden}
          phase={phase}
        />
      )}

      {/* Intro overlay */}
      {phase !== 'gallery' && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ right: isAdmin && !panelHidden ? 280 : 0 }}
        >

          {phase === 'entry' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff' }}>
              {/* full-screen gradient blob */}
              <div style={{
                position: 'absolute', right: '2%', bottom: '10%',
                width: '50%', height: '70%',
                background: 'radial-gradient(ellipse at 60% 60%, rgba(210,155,165,0.45) 0%, rgba(185,145,175,0.25) 35%, transparent 68%)',
                filter: 'blur(55px)',
                pointerEvents: 'none',
              }} />
              {/* REPLY svg */}
              <div style={{ flex: 1, width: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={['/reply.svg', '/reply1.svg', '/reply2.svg'][replyFrame]} alt="REPLY" style={{ width: '88%', height: 'auto', position: 'relative' }} />
              </div>
              {/* buttons */}
              <div style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
                <button
                  onClick={() => {
                    setWithSound(true)
                    startBgAudio(true)
                    goToGallery()
                  }}
                  style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.75)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >ENTER WITH SOUND</button>
                <button
                  onClick={() => {
                    setWithSound(false)
                    startBgAudio(false)
                    goToGallery()
                  }}
                  style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >ENTER WITHOUT SOUND</button>
              </div>
            </div>
          )}


        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" style={isAdmin && !panelHidden ? { right: 280 } : {}}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="font-mono text-sm font-semibold tracking-tight">Share something</span>
              <button onClick={closeModal} className="text-gray-400 hover:text-black transition-colors text-lg leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 min-h-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                className={`shrink-0 cursor-pointer rounded-xl border-2 border-dashed h-20 flex items-center justify-center transition-colors
                  ${dragging ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
              >
                <p className="font-mono text-xs text-gray-400">
                  {items.length > 0 ? '+ add more images' : 'drop images or click to browse'}
                </p>
                <input ref={fileInputRef} type="file" accept="image/*,image/svg+xml" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
              </div>

              {/* Student name selector */}
              <div className="shrink-0">
                <select
                  value={uploadStudentName}
                  onChange={e => setUploadStudentName(e.target.value)}
                  className="w-full font-mono text-xs border border-gray-200 rounded-lg px-3 py-2 focus:border-black outline-none bg-white"
                >
                  <option value="">— select your name —</option>
                  {STUDENTS.filter(s => s !== 'SELF').map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {items.length > 0 && (
                <div className="overflow-y-auto flex flex-col gap-2 min-h-0">
                  <div className="flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => { items.forEach(it => URL.revokeObjectURL(it.preview)); setItems([]) }}
                      className="font-mono text-xs text-gray-400 hover:text-black transition-colors"
                    >clear all</button>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-200">
                        <Image src={item.preview} alt="" fill className="object-cover" />
                      </div>
                      <input
                        type="text"
                        value={item.caption}
                        onChange={e => updateCaption(i, e.target.value)}
                        placeholder={fileToCaption(item.file)}
                        className="flex-1 font-mono text-xs bg-transparent border-b border-gray-200 focus:border-black outline-none py-1 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="shrink-0 text-gray-300 hover:text-black transition-colors text-sm leading-none"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}


              {error && <p className="font-mono text-xs text-red-500 shrink-0">{error}</p>}

              <button
                type="submit"
                disabled={submitting || items.length === 0}
                className="shrink-0 w-full bg-black text-white font-mono text-sm py-3 rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {submitting && progress
                  ? `uploading ${progress.done}/${progress.total}…`
                  : items.length > 1
                  ? `post ${items.length} images`
                  : 'post'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  )
}

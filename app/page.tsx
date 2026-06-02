'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { Post } from '@/lib/supabase'

const GlobeCanvas = dynamic(() => import('./globe'), { ssr: false })
const RoomCanvas  = dynamic(() => import('./room'),  { ssr: false })
import type { WireframeStyle } from './room'

const STUDENTS = ['Nodar Gogichaishvili','Sesili Gurgenidze','Dominika Davshrishovi','Nutsa Kavtelishvili','Ketevan Lomiashvili','Ana Mamniashvili','Sergi Sarajevi','Natali Chixelidze','Salome Shalvashvili','Bako Shengelia','Mariam Wulaia','Mariam Qsovreli']

type ImageItem = { file: File; preview: string; caption: string }

function fileToCaption(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}

type Phase = 'entry' | 'loading' | 'video' | 'gallery'

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
  font: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
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
  rotateSpeed, setRotateSpeed,
  globeScale, setGlobeScale,
  tileSize, setTileSize,
  tileStyle, setTileStyle,
  audioVolume, setAudioVolume,
  showNames, setShowNames,
  nameSize, setNameSize,
  scaleX, setScaleX,
  scaleY, setScaleY,
  showNoiseGlobe, setShowNoiseGlobe,
  noiseColor1, setNoiseColor1,
  noiseColor2, setNoiseColor2,
  noiseSpeed, setNoiseSpeed,
  noiseScale, setNoiseScale,
  showWireframe, setShowWireframe,
  wireframeSegments, setWireframeSegments,
  wireframeOpacity, setWireframeOpacity,
  wireframeColor, setWireframeColor,
  viewMode, setViewMode,
  timebombActive, setTimebombActive,
  hiddenCount, resetTimebomb,
  showTexture, setShowTexture,
  grainOpacity, setGrainOpacity,
  vignetteOpacity, setVignetteOpacity,
  wobbleScale, setWobbleScale,
  showDoggo, setShowDoggo,
  doggoScale, setDoggoScale,
  doggoX, setDoggoX,
  doggoY, setDoggoY,
  doggoZ, setDoggoZ,
  showFigure, setShowFigure,
  figureRadius, setFigureRadius,
  figureSpeed, setFigureSpeed,
  figureX, setFigureX,
  figureY, setFigureY,
  figureZ, setFigureZ,
  figureScale, setFigureScale,
  figureFacing, setFigureFacing,
  figureWireframe, setFigureWireframe,
  wireframeStyle, setWireframeStyle,
  dotSize, setDotSize,
  dotColor, setDotColor,
  dotCount, setDotCount,
  showWalls, setShowWalls,
  meshTexture, setMeshTexture,
  showVertexImages, setShowVertexImages,
  vertexImgSize, setVertexImgSize,
  vertexRepeat, setVertexRepeat,
  camX, setCamX,
  camY, setCamY,
  camZ, setCamZ,
  phase,
  hidden,
  posts,
  onDeletePost,
}: {
  rotateSpeed: number; setRotateSpeed: (v: number) => void
  globeScale: number; setGlobeScale: (v: number) => void
  tileSize: number; setTileSize: (v: number) => void
  tileStyle: 'billboard' | 'outward'; setTileStyle: (v: 'billboard' | 'outward') => void
  audioVolume: number; setAudioVolume: (v: number) => void
  showNames: boolean; setShowNames: (v: boolean) => void
  nameSize: number; setNameSize: (v: number) => void
  scaleX: number; setScaleX: (v: number) => void
  scaleY: number; setScaleY: (v: number) => void
  showNoiseGlobe: boolean; setShowNoiseGlobe: (v: boolean) => void
  noiseColor1: string; setNoiseColor1: (v: string) => void
  noiseColor2: string; setNoiseColor2: (v: string) => void
  noiseSpeed: number; setNoiseSpeed: (v: number) => void
  noiseScale: number; setNoiseScale: (v: number) => void
  showWireframe: boolean; setShowWireframe: (v: boolean) => void
  wireframeSegments: number; setWireframeSegments: (v: number) => void
  wireframeOpacity: number; setWireframeOpacity: (v: number) => void
  wireframeColor: string; setWireframeColor: (v: string) => void
  viewMode: 'globe' | 'room'; setViewMode: (v: 'globe' | 'room') => void
  timebombActive: boolean; setTimebombActive: (v: boolean) => void
  hiddenCount: number; resetTimebomb: () => void
  showTexture: boolean; setShowTexture: (v: boolean) => void
  grainOpacity: number; setGrainOpacity: (v: number) => void
  vignetteOpacity: number; setVignetteOpacity: (v: number) => void
  wobbleScale: number; setWobbleScale: (v: number) => void
  showDoggo: boolean; setShowDoggo: (v: boolean) => void
  doggoScale: number; setDoggoScale: (v: number) => void
  doggoX: number; setDoggoX: (v: number) => void
  doggoY: number; setDoggoY: (v: number) => void
  doggoZ: number; setDoggoZ: (v: number) => void
  showFigure: boolean; setShowFigure: (v: boolean) => void
  figureRadius: number; setFigureRadius: (v: number) => void
  figureSpeed: number; setFigureSpeed: (v: number) => void
  figureX: number; setFigureX: (v: number) => void
  figureY: number; setFigureY: (v: number) => void
  figureZ: number; setFigureZ: (v: number) => void
  figureScale: number; setFigureScale: (v: number) => void
  figureFacing: number; setFigureFacing: (v: number) => void
  figureWireframe: boolean; setFigureWireframe: (v: boolean) => void
  wireframeStyle: WireframeStyle; setWireframeStyle: (v: WireframeStyle) => void
  dotSize: number; setDotSize: (v: number) => void
  dotColor: string; setDotColor: (v: string) => void
  dotCount: number; setDotCount: (v: number) => void
  showWalls: boolean; setShowWalls: (v: boolean) => void
  meshTexture: string | null; setMeshTexture: (v: string | null) => void
  showVertexImages: boolean; setShowVertexImages: (v: boolean) => void
  vertexImgSize: number; setVertexImgSize: (v: number) => void
  vertexRepeat: number; setVertexRepeat: (v: number) => void
  camX: number; setCamX: (v: number) => void
  camY: number; setCamY: (v: number) => void
  camZ: number; setCamZ: (v: number) => void
  phase: Phase
  hidden: boolean
  posts: Post[]
  onDeletePost: (id: string) => Promise<void>
}) {
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
          options={[{ label: 'Globe', value: 'globe' }, { label: 'Room', value: 'room' }]}
          value={viewMode}
          onChange={v => setViewMode(v as 'globe' | 'room')}
        />
      </PanelSection>

      <PanelSection title="Audio">
        <PanelSlider label="Volume" value={audioVolume} min={0} max={1} step={0.01} decimals={2} onChange={setAudioVolume} />
      </PanelSection>

      <PanelSection title="Globe">
        <PanelSlider label="Rotation speed" value={rotateSpeed} min={0} max={5} step={0.1} decimals={1} onChange={setRotateSpeed} />
        <PanelSlider label="Globe scale" value={globeScale} min={0.4} max={2} step={0.05} decimals={2} onChange={setGlobeScale} />
        <PanelSlider label="Tile size" value={tileSize} min={0.3} max={1.8} step={0.05} decimals={2} onChange={setTileSize} />
      </PanelSection>

      <PanelSection title="Shape">
        <PanelSlider label="Horizontal stretch" value={scaleX} min={0.5} max={3} step={0.05} decimals={2} onChange={setScaleX} />
        <PanelSlider label="Vertical stretch" value={scaleY} min={0.5} max={3} step={0.05} decimals={2} onChange={setScaleY} />
      </PanelSection>

      <PanelSection title="Wireframe">
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Visibility</div>
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showWireframe ? 'show' : 'hide'}
          onChange={v => setShowWireframe(v === 'show')}
        />
        <PanelSlider label="Opacity" value={wireframeOpacity} min={0} max={1} step={0.01} decimals={2} onChange={setWireframeOpacity} />
        <PanelSlider label="Segments" value={wireframeSegments} min={4} max={32} step={2} decimals={0} onChange={setWireframeSegments} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <span style={{ fontSize: 11, color: P.text }}>Color</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: P.dim }}>{wireframeColor.toUpperCase()}</span>
            <input
              type="color" value={wireframeColor}
              onChange={e => setWireframeColor(e.target.value)}
              style={{ width: 24, height: 16, border: `1px solid ${P.borderStrong}`, background: 'transparent', cursor: 'pointer', padding: 0 }}
            />
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Noise">
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showNoiseGlobe ? 'show' : 'hide'}
          onChange={v => setShowNoiseGlobe(v === 'show')}
        />
        <PanelSlider label="Speed" value={noiseSpeed} min={0.05} max={3} step={0.05} decimals={2} onChange={setNoiseSpeed} />
        <PanelSlider label="Scale" value={noiseScale} min={0.2} max={5} step={0.1} decimals={1} onChange={setNoiseScale} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: P.text }}>Base color</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: P.dim }}>{noiseColor1.toUpperCase()}</span>
            <input type="color" value={noiseColor1} onChange={e => setNoiseColor1(e.target.value)}
              style={{ width: 24, height: 16, border: `1px solid ${P.borderStrong}`, background: 'transparent', cursor: 'pointer', padding: 0 }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <span style={{ fontSize: 11, color: P.text }}>Glow color</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: P.dim }}>{noiseColor2.toUpperCase()}</span>
            <input type="color" value={noiseColor2} onChange={e => setNoiseColor2(e.target.value)}
              style={{ width: 24, height: 16, border: `1px solid ${P.borderStrong}`, background: 'transparent', cursor: 'pointer', padding: 0 }} />
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Tiles">
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Orientation</div>
        <PanelToggle
          options={[{ label: 'Billboard', value: 'billboard' }, { label: 'Outward', value: 'outward' }]}
          value={tileStyle}
          onChange={v => setTileStyle(v as 'billboard' | 'outward')}
        />
        <div style={{ fontSize: 10, color: P.low, lineHeight: 1.6 }}>
          <strong style={{ color: P.dim }}>Billboard</strong> — always faces camera<br />
          <strong style={{ color: P.dim }}>Outward</strong> — rotates with globe
        </div>
      </PanelSection>

      <PanelSection title="Names">
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Visibility</div>
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showNames ? 'show' : 'hide'}
          onChange={v => setShowNames(v === 'show')}
        />
        <PanelSlider label="Font size" value={nameSize} min={6} max={24} step={0.5} decimals={1} onChange={setNameSize} />
      </PanelSection>

      <PanelSection title="Timebomb">
        <PanelToggle
          options={[{ label: 'Armed', value: 'on' }, { label: 'Safe', value: 'off' }]}
          value={timebombActive ? 'on' : 'off'}
          onChange={v => setTimebombActive(v === 'on')}
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

      <PanelSection title="Texture">
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showTexture ? 'show' : 'hide'}
          onChange={v => setShowTexture(v === 'show')}
        />
        <PanelSlider label="Grain intensity" value={grainOpacity} min={0} max={0.15} step={0.005} decimals={3} onChange={setGrainOpacity} />
        <PanelSlider label="Vignette intensity" value={vignetteOpacity} min={0} max={1} step={0.05} decimals={2} onChange={setVignetteOpacity} />
        <PanelSlider label="Wobble scale" value={wobbleScale} min={0} max={12} step={0.5} decimals={1} onChange={setWobbleScale} />
      </PanelSection>

      <PanelSection title="Doggo">
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showDoggo ? 'show' : 'hide'}
          onChange={v => setShowDoggo(v === 'show')}
        />
        <PanelSlider label="Scale"      value={doggoScale} min={0.1} max={200} step={0.5}  decimals={1} onChange={setDoggoScale} />
        <PanelSlider label="Position X" value={doggoX}     min={-200} max={200} step={2}    decimals={0} onChange={setDoggoX} />
        <PanelSlider label="Position Y" value={doggoY}     min={-10}  max={60}  step={0.5}  decimals={1} onChange={setDoggoY} />
        <PanelSlider label="Position Z" value={doggoZ}     min={-100} max={100} step={2}    decimals={0} onChange={setDoggoZ} />
      </PanelSection>

      <PanelSection title="Figure">
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showFigure ? 'show' : 'hide'}
          onChange={v => setShowFigure(v === 'show')}
        />
        <PanelSlider label="Scale"      value={figureScale}  min={0.1}  max={200}  step={0.5}  decimals={1} onChange={setFigureScale} />
        <PanelSlider label="Radius"     value={figureRadius} min={0.5}  max={200}  step={1}    decimals={1} onChange={setFigureRadius} />
        <PanelSlider label="Speed"      value={figureSpeed}  min={0}    max={5}    step={0.05} decimals={2} onChange={setFigureSpeed} />
        <PanelSlider label="Facing"     value={figureFacing} min={0}    max={6.28} step={0.05} decimals={2} onChange={setFigureFacing} />
        <PanelToggle
          options={[{ label: 'Solid', value: 'solid' }, { label: 'Wireframe', value: 'wire' }]}
          value={figureWireframe ? 'wire' : 'solid'}
          onChange={v => setFigureWireframe(v === 'wire')}
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
              onChange={v => setWireframeStyle(v as WireframeStyle)}
            />
            {wireframeStyle === 'points' && (
              <>
                <PanelSlider label="Dot count" value={dotCount} min={100} max={50000} step={100} decimals={0} onChange={setDotCount} />
                <PanelSlider label="Dot size"  value={dotSize}  min={0.001} max={1} step={0.001} decimals={3} onChange={setDotSize} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 8px' }}>
                  <span style={{ fontSize: 11, color: P.dim }}>Dot color</span>
                  <input
                    type="color"
                    value={dotColor}
                    onChange={e => setDotColor(e.target.value)}
                    style={{ width: 32, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                  />
                </div>
              </>
            )}
          </>
        )}
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Walls</div>
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showWalls ? 'show' : 'hide'}
          onChange={v => setShowWalls(v === 'show')}
        />
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Vertex images</div>
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showVertexImages ? 'show' : 'hide'}
          onChange={v => setShowVertexImages(v === 'show')}
        />
        <PanelSlider label="Image size"   value={vertexImgSize}  min={0.005} max={3}  step={0.005} decimals={3} onChange={setVertexImgSize} />
        <PanelSlider label="Image repeat" value={vertexRepeat}   min={1}     max={50} step={1}     decimals={0} onChange={setVertexRepeat} />
        <PanelSlider label="Center X"   value={figureX}      min={-200} max={200} step={2}    decimals={0} onChange={setFigureX} />
        <PanelSlider label="Center Y"   value={figureY}      min={-100} max={100} step={1}    decimals={0} onChange={setFigureY} />
        <PanelSlider label="Center Z"   value={figureZ}      min={-100} max={100} step={2}    decimals={0} onChange={setFigureZ} />
      </PanelSection>

      <PanelSection title="Mesh texture">
        {meshTexture ? (
          <div style={{ marginBottom: 10 }}>
            <img src={meshTexture} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block', marginBottom: 8 }} />
            <button
              onClick={() => { URL.revokeObjectURL(meshTexture); setMeshTexture(null) }}
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
              setMeshTexture(URL.createObjectURL(file))
              e.target.value = ''
            }}
          />
        </label>
      </PanelSection>

      <PanelSection title="Camera">
        <PanelSlider label="X" value={camX} min={-240} max={240} step={1} decimals={0} onChange={setCamX} />
        <PanelSlider label="Y" value={camY} min={0}    max={400} step={1} decimals={0} onChange={setCamY} />
        <PanelSlider label="Z" value={camZ} min={-480} max={100} step={1} decimals={0} onChange={setCamZ} />
      </PanelSection>

      <PanelSection title="Posts">
        <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {posts.length === 0 && <div style={{ fontSize: 10, color: P.low }}>No posts yet</div>}
          {posts.map(post => (
            <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={post.image_url} style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: P.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post.student_name ?? '—'}
                </div>
                <div style={{ fontSize: 9, color: P.low, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post.text}
                </div>
              </div>
              <button
                onClick={() => onDeletePost(post.id)}
                style={{
                  flexShrink: 0, fontFamily: P.font, fontSize: 10,
                  padding: '3px 7px', background: 'transparent',
                  color: '#cc4444', border: `1px solid #cc4444`,
                  cursor: 'pointer', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </PanelSection>

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
  const [barWidth, setBarWidth] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

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

  const [rotateSpeed, setRotateSpeed] = useState(0.05)
  const [globeScale, setGlobeScale] = useState(1.5)
  const [tileSize, setTileSize] = useState(0.40)
  const [tileStyle, setTileStyle] = useState<'billboard' | 'outward'>('billboard')
  const [audioVolume, setAudioVolume] = useState(0.10)
  const [showNames, setShowNames] = useState(true)
  const [nameSize, setNameSize] = useState(10)
  const [scaleX, setScaleX] = useState(1.0)
  const [scaleY, setScaleY] = useState(1.0)
  const [showNoiseGlobe, setShowNoiseGlobe] = useState(false)
  const [noiseColor1, setNoiseColor1] = useState('#08003a')
  const [noiseColor2, setNoiseColor2] = useState('#8c1aff')
  const [noiseSpeed, setNoiseSpeed] = useState(0.5)
  const [noiseScale, setNoiseScale] = useState(1.0)
  const [showWireframe, setShowWireframe] = useState(false)
  const [wireframeSegments, setWireframeSegments] = useState(16)
  const [wireframeOpacity, setWireframeOpacity] = useState(0.15)
  const [wireframeColor, setWireframeColor] = useState('#000000')
  const [timebombActive, setTimebombActive] = useState(false)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [showAbout, setShowAbout] = useState(false)

  const [viewMode, setViewMode] = useState<'globe' | 'room'>('room')
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [personalRoomKey, setPersonalRoomKey] = useState(0)

  const switchView = (v: 'globe' | 'room') => {
    if (v === 'room') setRoomKey(k => k + 1)
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

  // Delay mounting the room canvas so the GPU can release the globe context first
  const [mountedView, setMountedView] = useState<'globe' | 'room'>('room')
  useEffect(() => {
    if (viewMode === 'globe') { setMountedView('globe'); return }
    const id = setTimeout(() => setMountedView('room'), 200)
    return () => clearTimeout(id)
  }, [viewMode])

  // Delay mounting personal room canvas too
  const [mountedStudent, setMountedStudent] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedStudent) { setMountedStudent(null); return }
    const id = setTimeout(() => setMountedStudent(selectedStudent), 200)
    return () => clearTimeout(id)
  }, [selectedStudent])

  const grainRef = useRef<SVGFETurbulenceElement>(null)
  const [showTexture, setShowTexture] = useState(false)
  const [grainOpacity, setGrainOpacity] = useState(0.055)
  const [vignetteOpacity, setVignetteOpacity] = useState(0.6)
  const [wobbleScale, setWobbleScale] = useState(4)
  const [showDoggo, setShowDoggo] = useState(false)
  const [doggoScale, setDoggoScale] = useState(40)
  const [doggoX, setDoggoX] = useState(0)
  const [doggoY, setDoggoY] = useState(0)
  const [doggoZ, setDoggoZ] = useState(0)
  const [showFigure, setShowFigure] = useState(true)
  const [figureRadius, setFigureRadius] = useState(145.5)
  const [figureSpeed, setFigureSpeed] = useState(0.05)
  const [figureX, setFigureX] = useState(0)
  const [figureY, setFigureY] = useState(-10)
  const [figureZ, setFigureZ] = useState(0)
  const [figureScale, setFigureScale] = useState(200)
  const [figureFacing, setFigureFacing] = useState(4.65)
  const [figureWireframe, setFigureWireframe] = useState(true)
  const [wireframeStyle, setWireframeStyle] = useState<WireframeStyle>('points')
  const [dotSize, setDotSize] = useState(0.400)
  const [meshTexture, setMeshTexture] = useState<string | null>(null)
  const [dotColor, setDotColor] = useState('#000000')
  const [dotCount, setDotCount] = useState(30000)
  const [showWalls, setShowWalls] = useState(false)
  const [showVertexImages, setShowVertexImages] = useState(true)
  const [vertexImgSize, setVertexImgSize] = useState(0.025)
  const [vertexRepeat, setVertexRepeat] = useState(1)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const figureStudent  = selectedStudents[0] ?? null
  const figureStudent2 = selectedStudents[1] ?? null
  const figureOrbiting = selectedStudents.length === 2

  const handleStudentSelect = (name: string) => {
    setSelectedStudents(prev => {
      const idx = prev.indexOf(name)
      if (idx !== -1) return prev.filter(s => s !== name)
      if (prev.length < 2) return [...prev, name]
      return [prev[1], name]
    })
  }

  const [camX, setCamX] = useState(0)
  const [camY, setCamY] = useState(260)
  const [camZ, setCamZ] = useState(-35)
  const [panelHidden, setPanelHidden] = useState(false)

  const isAdmin = useSearchParams().get('admin') === 'true'

  // H key toggles admin panel; enabling texture when hiding
  useEffect(() => {
    if (!isAdmin) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setPanelHidden(prev => {
          const hiding = !prev
          if (hiding) setShowTexture(false)
          return hiding
        })
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
        if (audio.paused) { audio.play().catch(() => {}) } else { audio.pause() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Sync audio volume live
  useEffect(() => {
    if (bgAudioRef.current) bgAudioRef.current.volume = audioVolume
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

  useEffect(() => {
    if (!showTexture) return
    let s = 0
    const id = setInterval(() => {
      s = (s + 1) % 100
      grainRef.current?.setAttribute('seed', String(s))
    }, 100)
    return () => clearInterval(id)
  }, [showTexture])

  const [barDone, setBarDone] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  // Loading bar — sets barDone after animation
  useEffect(() => {
    if (phase !== 'loading') return
    setBarDone(false)
    setVideoReady(false)
    requestAnimationFrame(() => setBarWidth(100))
    const t = setTimeout(() => setBarDone(true), 2800)
    return () => clearTimeout(t)
  }, [phase])

  // Advance to video only when both bar animation and video are ready.
  // Fallback: if video never fires canplaythrough (iOS), proceed after 3s.
  useEffect(() => {
    if (phase === 'loading' && barDone && videoReady) setPhase('video')
  }, [barDone, videoReady, phase])

  useEffect(() => {
    if (!barDone || phase !== 'loading') return
    const fallback = setTimeout(() => setVideoReady(true), 3000)
    return () => clearTimeout(fallback)
  }, [barDone, phase])

  useEffect(() => {
    if (phase !== 'video' || !videoRef.current) return
    const v = videoRef.current
    v.muted = !withSound
    v.play().catch(() => {})
  }, [phase])

  function startBgAudio(sound: boolean) {
    if (!sound) return
    const audio = new Audio('/fx_bg.mp3')
    audio.loop = true
    audio.volume = audioVolume
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyser.connect(ctx.destination)
      analyserRef.current = analyser
    } catch {}
    audio.play().catch(() => {})
    bgAudioRef.current = audio
  }

  function goToGallery() {
    setFadeOut(true)
    setTimeout(() => setPhase('gallery'), 600)
  }

  useEffect(() => {
    fetch('/api/posts')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPosts(data); setLoading(false) })
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

  async function handleDeletePost(id: string) {
    await fetch(`/api/posts?id=${id}`, { method: 'DELETE' })
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
    setSubmitting(true)
    setError(null)
    setProgress({ done: 0, total: items.length })

    const newPosts: Post[] = []
    for (const item of items) {
      const fd = new FormData()
      fd.append('image', item.file)
      fd.append('text', item.caption.trim() || fileToCaption(item.file))
      if (uploadStudentName) fd.append('student_name', uploadStudentName)
      const res = await fetch('/api/posts', { method: 'POST', body: fd })
      if (res.ok) newPosts.push(await res.json())
      setProgress(p => p ? { ...p, done: p.done + 1 } : null)
    }

    if (newPosts.length > 0) setPosts(p => [...newPosts.reverse(), ...p])
    if (newPosts.length < items.length) {
      setError(`${items.length - newPosts.length} image(s) failed to upload.`)
      setSubmitting(false)
      return
    }
    closeModal()
    setSubmitting(false)
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-white relative">
      {/* Logo */}
      <div className="fixed top-9 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
        <img src="/logo.svg" alt="Reply" className="h-10 w-auto" />
      </div>

      {/* View toggle */}
      {phase === 'gallery' && !loading && posts.length > 0 && !selectedStudent && (
        <div
          className="fixed top-6 z-20"
          style={{ right: isAdmin && !panelHidden ? 296 : 16 }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            {(['globe', 'room'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => switchView(mode)}
                style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
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

      {/* About button */}
      {phase === 'gallery' && !selectedStudent && (
        <button
          onClick={() => setShowAbout(v => !v)}
          style={{
            position: 'fixed', top: 24, left: 24, zIndex: 60,
            fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
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
            backdropFilter: 'blur(18px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '40px 24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 580, width: '100%' }}
          >
            <p style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 2,
              color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em',
              whiteSpace: 'pre-line',
            }}>{`Reply is a concept rooted in the constant communication of the digital world, a collaborative work by students of the Free University of Georgia, and a dialogue between selves and their relationships.

While the physical self can be expressed in countless ways, Reply explores our virtual identities, the endless demands of digital presence, and the fragmented versions of ourselves we perform across platforms.

Each platform demands a different self, the visual one, the political one, the informed one, the one who dances. Not one of them leaves room for the self that simply is.

To explore this idea further, the students created their own writing systems, ways of saying what they truly feel, without being observed, evaluated, or judged. Only felt.

Reply is a virtual art exhibition that challenges the limits of natural language as a form of communication, and instead invites visitors to experience each person through a unique visual representation of who they are.`}</p>
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
        <img src="/UNI.svg" alt="Free University of Tbilisi" className="h-12 w-auto" />
      </a>

      {/* Student selector — left panel, room view only */}
      {phase === 'gallery' && mountedView === 'room' && !selectedStudent && (
        <div style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20,
          width: 160,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '32px 0',
          fontFamily: 'ui-monospace, monospace',
          overflowY: 'auto',
        }}>
          {STUDENTS.map(name => {
            const isSelected = selectedStudents.includes(name)
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
                  color: '#000000',
                  opacity: isSelected ? 1 : 0.35,
                  transition: 'opacity 0.15s',
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
        filter: [
          isAdmin && showTexture && wobbleScale > 0 ? 'url(#hand-drawn-filter)' : '',
          phase === 'entry' ? 'blur(42.5px)' : '',
        ].filter(Boolean).join(' ') || undefined,
      }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-gray-300 text-sm animate-pulse">loading…</span>
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-gray-300 text-sm">nothing here yet — be first.</span>
          </div>
        )}
        {!loading && posts.length > 0 && mountedView === 'room' && !selectedStudent && (
          <RoomCanvas key={roomKey} posts={posts.filter(p => !hiddenIds.has(p.id))} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} vertexRepeat={vertexRepeat} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} showWalls={showWalls} meshTexture={meshTexture} analyserRef={analyserRef} />
        )}
        {!loading && posts.length > 0 && mountedView === 'globe' && !selectedStudent && (
          <GlobeCanvas
            posts={posts.filter(p => !hiddenIds.has(p.id))}
            rotateSpeed={rotateSpeed}
            scale={globeScale}
            tileSize={tileSize}
            tileStyle={tileStyle}
            showNames={showNames}
            nameSize={nameSize}
            scaleX={scaleX}
            scaleY={scaleY}
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
          />
        )}

        {/* Personal student room */}
        {mountedStudent && (
          <RoomCanvas key={personalRoomKey} posts={posts.filter(p => p.student_name === mountedStudent)} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} vertexRepeat={vertexRepeat} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} showWalls={showWalls} meshTexture={meshTexture} analyserRef={analyserRef} />
        )}
      </div>

      {/* Student room back button */}
      {selectedStudent && (
        <button
          onClick={closeStudentRoom}
          style={{
            position: 'fixed', top: 24, left: 24, zIndex: 60,
            fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
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
          fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: 2,
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none',
        }}>
          {selectedStudent}
        </div>
      )}

      {/* Texture overlays */}
      {isAdmin && showTexture && (<>
        <svg style={{ display: 'none', position: 'absolute' }} aria-hidden="true">
          <defs>
            <filter id="hand-drawn-filter">
              <feTurbulence type="turbulence" baseFrequency="0.025" numOctaves="3" seed="7" stitchTiles="stitch" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={wobbleScale} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, pointerEvents: 'none', opacity: 0.18, mixBlendMode: 'multiply' } as React.CSSProperties}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="paper-fiber-filter" x="0%" y="0%" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.65 0.08" numOctaves="5" seed="3" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#paper-fiber-filter)" fill="#8B7355" />
          </svg>
        </div>
        <div style={{ position: 'fixed', inset: '-50%', zIndex: 56, width: '200%', height: '200%', pointerEvents: 'none', opacity: grainOpacity, mixBlendMode: 'overlay' } as React.CSSProperties}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="grain-filter" x="0%" y="0%" width="100%" height="100%">
                <feTurbulence ref={grainRef} type="fractalNoise" baseFrequency="0.85" numOctaves="4" seed="0" stitchTiles="stitch" />
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#grain-filter)" />
          </svg>
        </div>
        <div style={{ position: 'fixed', inset: 0, zIndex: 57, pointerEvents: 'none', background: `radial-gradient(ellipse at center, transparent 30%, rgba(10,5,0,${vignetteOpacity}) 100%)` }} />
      </>)}

      {/* Upload FAB */}
      {phase === 'gallery' && (
        <button
          onClick={() => setShowUpload(true)}
          className="fixed bottom-9 left-1/2 -translate-x-1/2 z-20 bg-white shadow-md rounded-full px-7 py-[18px] font-mono text-black text-xl leading-none hover:shadow-lg transition-shadow border border-gray-100"
          aria-label="Upload"
          style={{ transform: 'translateX(calc(-50% - 140px))' }}
        >
          +
        </button>
      )}

      {/* Admin panel */}
      {isAdmin && (
        <AdminPanel
          hidden={panelHidden}
          rotateSpeed={rotateSpeed} setRotateSpeed={setRotateSpeed}
          globeScale={globeScale} setGlobeScale={setGlobeScale}
          scaleX={scaleX} setScaleX={setScaleX}
          scaleY={scaleY} setScaleY={setScaleY}
          tileSize={tileSize} setTileSize={setTileSize}
          tileStyle={tileStyle} setTileStyle={setTileStyle}
          audioVolume={audioVolume} setAudioVolume={setAudioVolume}
          showNames={showNames} setShowNames={setShowNames}
          nameSize={nameSize} setNameSize={setNameSize}
          timebombActive={timebombActive} setTimebombActive={setTimebombActive}
          hiddenCount={hiddenIds.size} resetTimebomb={() => setHiddenIds(new Set())}
          showNoiseGlobe={showNoiseGlobe} setShowNoiseGlobe={setShowNoiseGlobe}
          noiseColor1={noiseColor1} setNoiseColor1={setNoiseColor1}
          noiseColor2={noiseColor2} setNoiseColor2={setNoiseColor2}
          noiseSpeed={noiseSpeed} setNoiseSpeed={setNoiseSpeed}
          noiseScale={noiseScale} setNoiseScale={setNoiseScale}
          showWireframe={showWireframe} setShowWireframe={setShowWireframe}
          wireframeSegments={wireframeSegments} setWireframeSegments={setWireframeSegments}
          wireframeOpacity={wireframeOpacity} setWireframeOpacity={setWireframeOpacity}
          wireframeColor={wireframeColor} setWireframeColor={setWireframeColor}
          viewMode={viewMode} setViewMode={switchView}
          showTexture={showTexture} setShowTexture={setShowTexture}
          grainOpacity={grainOpacity} setGrainOpacity={setGrainOpacity}
          vignetteOpacity={vignetteOpacity} setVignetteOpacity={setVignetteOpacity}
          wobbleScale={wobbleScale} setWobbleScale={setWobbleScale}
          showDoggo={showDoggo} setShowDoggo={setShowDoggo}
          doggoScale={doggoScale} setDoggoScale={setDoggoScale}
          doggoX={doggoX} setDoggoX={setDoggoX}
          doggoY={doggoY} setDoggoY={setDoggoY}
          doggoZ={doggoZ} setDoggoZ={setDoggoZ}
          showFigure={showFigure} setShowFigure={setShowFigure}
          figureRadius={figureRadius} setFigureRadius={setFigureRadius}
          figureSpeed={figureSpeed} setFigureSpeed={setFigureSpeed}
          figureX={figureX} setFigureX={setFigureX}
          figureY={figureY} setFigureY={setFigureY}
          figureZ={figureZ} setFigureZ={setFigureZ}
          figureScale={figureScale} setFigureScale={setFigureScale}
          figureFacing={figureFacing} setFigureFacing={setFigureFacing}
          figureWireframe={figureWireframe} setFigureWireframe={setFigureWireframe}
          wireframeStyle={wireframeStyle} setWireframeStyle={setWireframeStyle}
          dotSize={dotSize} setDotSize={setDotSize}
          dotColor={dotColor} setDotColor={setDotColor}
          dotCount={dotCount} setDotCount={setDotCount}
          showWalls={showWalls} setShowWalls={setShowWalls}
          meshTexture={meshTexture} setMeshTexture={setMeshTexture}
          showVertexImages={showVertexImages} setShowVertexImages={setShowVertexImages}
          vertexImgSize={vertexImgSize} setVertexImgSize={setVertexImgSize}
          vertexRepeat={vertexRepeat} setVertexRepeat={setVertexRepeat}
          camX={camX} setCamX={setCamX}
          camY={camY} setCamY={setCamY}
          camZ={camZ} setCamZ={setCamZ}
          phase={phase}
          posts={posts}
          onDeletePost={handleDeletePost}
        />
      )}

      {/* Intro overlay */}
      {phase !== 'gallery' && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: phase === 'entry' ? 'transparent' : '#ffffff', opacity: fadeOut ? 0 : 1, transition: 'opacity 0.6s ease', right: isAdmin && !panelHidden ? 280 : 0 }}
          onClick={phase === 'video' ? goToGallery : undefined}
        >
          {/* Video element lives here from entry onwards so iOS gesture unlock works */}
          <video
            ref={videoRef}
            src="/intro.mp4"
            preload="auto"
            playsInline
            style={{ display: phase === 'video' ? 'block' : 'none' }}
            className="h-screen w-full min-[960px]:h-[60vh] min-[960px]:w-auto object-contain"
            onLoadedData={() => setVideoReady(true)}
            onCanPlayThrough={() => setVideoReady(true)}
            onEnded={goToGallery}
          />

          {phase === 'entry' && (
            <div className="flex flex-col items-center gap-8">
              <p className="font-mono text-black/60 text-[11px] tracking-[0.2em] uppercase text-center">
                this interactive audio piece is best experienced with sound on
              </p>
              <div className="flex items-center gap-6">
                <button
                  onClick={() => {
                    setWithSound(true)
                    // Unlock video on iOS while gesture is fresh
                    if (videoRef.current) { videoRef.current.muted = true; videoRef.current.play().then(() => videoRef.current?.pause()).catch(() => {}) }
                    setBarWidth(0); setPhase('loading'); startBgAudio(true)
                  }}
                  className="font-mono text-[11px] tracking-[0.2em] uppercase text-black border border-black px-5 py-2.5 hover:bg-black hover:text-white transition-colors"
                >
                  enable sound
                </button>
                <button
                  onClick={() => {
                    setWithSound(false)
                    if (videoRef.current) { videoRef.current.muted = true; videoRef.current.play().then(() => videoRef.current?.pause()).catch(() => {}) }
                    setBarWidth(0); setPhase('loading')
                  }}
                  className="font-mono text-[11px] tracking-[0.2em] uppercase text-black/40 hover:text-black transition-colors"
                >
                  disable sound
                </button>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <>
              <div className="w-48 h-px bg-black/10 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-black/60"
                  style={{ width: `${barWidth}%`, transition: 'width 2.6s cubic-bezier(0.4,0,0.2,1)' }}
                />
              </div>
            </>
          )}

          {phase === 'video' && (
            <>
              <button
                onClick={goToGallery}
                className="absolute bottom-9 right-9 font-mono text-black/50 hover:text-black text-[11px] tracking-[0.2em] uppercase transition-colors"
              >
                skip →
              </button>
            </>
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
                  {STUDENTS.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {items.length > 0 && (
                <div className="overflow-y-auto flex flex-col gap-2 min-h-0">
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

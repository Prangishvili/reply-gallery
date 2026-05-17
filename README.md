# Reply.

An interactive 3D gallery for university students to share images and text. Images are placed on a rotating 3D globe — drag to explore, hover to read captions.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Three.js** via `@react-three/fiber` + `@react-three/drei` — 3D globe
- **Supabase** — Postgres (post metadata) + Storage (image files)
- **Vercel** — deployment

## Features

- Intro sequence: sound prompt → loading bar → fullscreen video → globe
- 3D interactive globe with Fibonacci-distributed image tiles
- Drag to rotate, scroll to zoom, hover to reveal captions
- Batch image upload — multiple files, individual captions (auto-filled from filename)
- Admin controls panel at `/?admin=true` — rotation speed + globe size sliders
- Custom logo (`/public/logo.svg`) and intro video (`/public/intro.mp4`)

## Project structure

```
app/
  page.tsx          # Main UI — intro phases, upload modal, admin controls
  globe.tsx         # Three.js scene — 3D globe with image tiles
  api/posts/
    route.ts        # GET + POST endpoints
lib/
  supabase.ts       # Supabase client + Post type
public/
  logo.svg          # Custom logo
  intro.mp4         # Intro video
supabase-setup.sql  # Run once in Supabase SQL Editor to set up DB
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. SQL Editor → run `supabase-setup.sql`
3. Storage → create bucket `images` (public) with anon INSERT policy
4. Settings → API → copy Project URL and publishable key

### 2. Environment variables

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

Push to GitHub, import on [vercel.com](https://vercel.com), add env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in project settings, deploy.

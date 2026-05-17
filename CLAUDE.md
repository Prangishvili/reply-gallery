@AGENTS.md

# Project: Reply.

Interactive 3D gallery — Next.js 16 + Three.js + Supabase + Vercel.

## Key files

- `app/page.tsx` — all UI: intro phases (sound prompt → loading bar → video → globe), upload modal, admin sliders
- `app/globe.tsx` — Three.js Canvas, Scene, Tile components; Fibonacci sphere distribution
- `app/api/posts/route.ts` — GET all posts, POST new post (upload image to Supabase Storage + insert row)
- `lib/supabase.ts` — Supabase client + `Post` type
- `supabase-setup.sql` — full DB setup: table, RLS policies, grants

## Conventions

- All components are client components (`'use client'`)
- `app/globe.tsx` is dynamically imported with `ssr: false` to avoid Three.js SSR issues
- Images stored in Supabase Storage bucket `images` (public), URLs saved in `posts.image_url`
- Admin panel hidden behind `?admin=true` URL param
- Intro video at `public/intro.mp4`, logo at `public/logo.svg`

## Supabase

- Project: freeunigallery (org: Prangi, region: Oceania/Sydney)
- Table: `posts` (id uuid, text, image_url, created_at)
- Storage bucket: `images` (public)
- Key: use publishable key (`sb_publishable_...`) for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

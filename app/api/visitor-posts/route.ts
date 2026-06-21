import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

export async function GET() {
  const { data, error } = await supabase
    .from('visitor_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map to Post shape so GlobeCanvas can consume it without type changes
  const mapped = (data ?? []).map((v: { id: string; image_url: string; visitor_name: string | null; created_at: string }) => ({
    id: v.id,
    image_url: v.image_url,
    text: v.visitor_name ?? '',
    student_name: null,
    created_at: v.created_at,
  }))

  return NextResponse.json(mapped)
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const image = formData.get('image') as File | null
  const visitorName = formData.get('visitor_name') as string | null

  if (!image) return NextResponse.json({ error: 'Image is required' }, { status: 400 })

  const fileName = `${uuidv4()}.webp`
  const arrayBuffer = await image.arrayBuffer()

  const uploadBuffer = await sharp(Buffer.from(arrayBuffer))
    .webp({ quality: 85 })
    .toBuffer()

  const { error: uploadError } = await supabase.storage
    .from('visitor-images')
    .upload(fileName, uploadBuffer, { contentType: 'image/webp', cacheControl: '31536000' })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: publicData } = supabase.storage
    .from('visitor-images')
    .getPublicUrl(fileName)

  const { data, error: insertError } = await supabase
    .from('visitor_posts')
    .insert({ image_url: publicData.publicUrl, visitor_name: visitorName?.trim() || null })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

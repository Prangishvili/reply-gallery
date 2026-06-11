import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const image = formData.get('image') as File | null
  const text = formData.get('text') as string | null
  const studentName = formData.get('student_name') as string | null

  if (!image || !text?.trim()) {
    return NextResponse.json({ error: 'Image and text are required' }, { status: 400 })
  }

  const isSvg = image.type === 'image/svg+xml'
  const ext = isSvg ? 'svg' : 'webp'
  const fileName = `${uuidv4()}.${ext}`
  const arrayBuffer = await image.arrayBuffer()

  let uploadBuffer: Buffer
  let contentType: string
  if (isSvg) {
    uploadBuffer = Buffer.from(arrayBuffer)
    contentType = 'image/svg+xml'
  } else {
    uploadBuffer = await sharp(Buffer.from(arrayBuffer))
      .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    contentType = 'image/webp'
  }

  // Filenames are UUIDs (content never changes), so cache for a year —
  // avoids a ~1s revalidation round trip per image on repeat visits
  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(fileName, uploadBuffer, { contentType, cacheControl: '31536000' })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicData } = supabase.storage
    .from('images')
    .getPublicUrl(fileName)

  const { data, error: insertError } = await supabase
    .from('posts')
    .insert({ text: text.trim(), image_url: publicData.publicUrl, student_name: studentName?.trim() || null })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = adminClient()

  const { data: post } = await admin.from('posts').select('image_url').eq('id', id).single()
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const fileName = post.image_url.split('/').pop() as string
  await admin.storage.from('images').remove([fileName])

  const { error } = await admin.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

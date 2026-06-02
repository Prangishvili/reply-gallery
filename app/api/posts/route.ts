import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

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

  const isPng = image.type === 'image/png'
  const ext = isPng ? 'png' : 'jpg'
  const fileName = `${uuidv4()}.${ext}`
  const arrayBuffer = await image.arrayBuffer()
  const pipeline = sharp(Buffer.from(arrayBuffer))
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
  const compressed = await (isPng ? pipeline.png({ compressionLevel: 8 }) : pipeline.jpeg({ quality: 100 })).toBuffer()

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(fileName, compressed, { contentType: isPng ? 'image/png' : 'image/jpeg' })

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

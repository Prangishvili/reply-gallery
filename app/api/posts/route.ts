import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

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

  if (!image || !text?.trim()) {
    return NextResponse.json({ error: 'Image and text are required' }, { status: 400 })
  }

  const ext = image.name.split('.').pop()
  const fileName = `${uuidv4()}.${ext}`
  const arrayBuffer = await image.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(fileName, buffer, { contentType: image.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicData } = supabase.storage
    .from('images')
    .getPublicUrl(fileName)

  const { data, error: insertError } = await supabase
    .from('posts')
    .insert({ text: text.trim(), image_url: publicData.publicUrl })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

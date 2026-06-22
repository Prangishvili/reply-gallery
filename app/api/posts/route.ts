import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

export async function POST() {
  return NextResponse.json({ error: 'Closed' }, { status: 403 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Closed' }, { status: 403 })
}

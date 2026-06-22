import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const TIMEOUT_MINUTES = 5

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only handle root path
  if (pathname === '/') {
    const visitedAt = request.cookies.get('reply_visited_at')?.value

    // If not visited, redirect to intro
    if (!visitedAt) {
      return NextResponse.redirect(new URL('/intro', request.url))
    }

    // Check if 20+ minutes have passed since last visit
    const lastVisit = parseInt(visitedAt)
    const now = Date.now()
    const minutesPassed = (now - lastVisit) / (1000 * 60)

    if (minutesPassed > TIMEOUT_MINUTES) {
      return NextResponse.redirect(new URL('/intro', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}

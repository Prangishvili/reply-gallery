import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only handle root path
  if (pathname === '/') {
    const replied = request.cookies.get('reply_visited')?.value === 'true'

    // If not visited, redirect to intro
    if (!replied) {
      return NextResponse.redirect(new URL('/intro', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}

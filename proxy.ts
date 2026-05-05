import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('dashboard_auth')?.value
  if (token === process.env.AUTH_TOKEN) {
    return NextResponse.next()
  }

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json).*)'],
}

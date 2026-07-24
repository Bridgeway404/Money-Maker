import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decideRoute } from '@/lib/auth/route-access'
import { createSupabaseAuthState } from '@/lib/auth/supabase-auth-state'

// Next.js 16 proxy (the renamed middleware convention). Refreshes the
// Supabase session on every matched request, then applies the route rules
// in src/lib/auth/route-access.ts.
//
// @supabase/ssr >= 0.10 contract: when auth cookies are (re)written, setAll
// receives a SECOND argument — headers that MUST be set on the response so
// no CDN or proxy ever caches a response carrying auth cookies
// (Cache-Control: private/no-store…, Expires: 0, Pragma: no-cache). The
// tracker records both the exact cookie records and those headers, and
// every return path — pass-through AND redirects — carries them.

export async function proxy(request: NextRequest) {
  const authState = createSupabaseAuthState()
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
          headers: Record<string, string>
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          authState.record(cookiesToSet, headers)
          supabaseResponse = authState.applySupabaseAuthState(
            NextResponse.next({ request })
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const decision = decideRoute(request.nextUrl.pathname, Boolean(user))

  if (decision.action === 'redirect-login') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', decision.redirectTo)
    return authState.applySupabaseAuthState(NextResponse.redirect(loginUrl))
  }

  if (decision.action === 'redirect-dashboard') {
    return authState.applySupabaseAuthState(
      NextResponse.redirect(new URL('/dashboard', request.url))
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

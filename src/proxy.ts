import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decideRoute } from '@/lib/auth/route-access'

// Next.js 16 proxy (the renamed middleware convention). Behavior is
// identical to the previous middleware.ts: refresh the Supabase session on
// every matched request (auth.getUser() writes refreshed auth cookies back
// onto the response via the getAll/setAll contract), then apply the route
// rules in src/lib/auth/route-access.ts.

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
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
    return NextResponse.redirect(loginUrl)
  }

  if (decision.action === 'redirect-dashboard') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

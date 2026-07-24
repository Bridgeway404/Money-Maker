import type { CookieOptions } from '@supabase/ssr'

// Tracks the auth state @supabase/ssr writes during a proxy pass — the
// refreshed cookie records (exact name/value/options) and the
// cache-protection headers the library supplies as setAll's second argument
// (Cache-Control / Expires / Pragma) — so EVERY response we return,
// including redirects created after the refresh, carries the same
// authentication state. Dropping either causes cached auth responses at the
// CDN or browser/server session drift (premature logout, redirect loops).

export interface RefreshedCookie {
  name: string
  value: string
  options: CookieOptions
}

// Structural response type: NextResponse satisfies it, and tests can pass a
// plain mock — no network, no real Supabase service needed.
export interface CookieCarryingResponse {
  cookies: { set(name: string, value: string, options?: CookieOptions): unknown }
  headers: { set(name: string, value: string): void }
}

export interface SupabaseAuthState {
  /** Called from setAll with the exact records @supabase/ssr supplied. */
  record(cookies: RefreshedCookie[], headers?: Record<string, string>): void
  /** True once the library has written refreshed auth cookies. */
  readonly hasRefreshedCookies: boolean
  /**
   * Copy the tracked cookie records (exact options included) and the
   * supplied headers onto a response. Safe no-op when nothing was
   * refreshed. Only Supabase-supplied state is copied — never arbitrary
   * internal Next.js middleware headers.
   */
  applySupabaseAuthState<T extends CookieCarryingResponse>(response: T): T
  /** For tests/diagnostics: the tracked state. */
  snapshot(): { cookies: RefreshedCookie[]; headers: Record<string, string> }
}

export function createSupabaseAuthState(): SupabaseAuthState {
  const refreshedCookies: RefreshedCookie[] = []
  const suppliedHeaders: Record<string, string> = {}

  return {
    record(cookies, headers = {}) {
      refreshedCookies.push(...cookies)
      Object.assign(suppliedHeaders, headers)
    },

    get hasRefreshedCookies() {
      return refreshedCookies.length > 0
    },

    applySupabaseAuthState(response) {
      for (const { name, value, options } of refreshedCookies) {
        response.cookies.set(name, value, options)
      }
      for (const [key, value] of Object.entries(suppliedHeaders)) {
        response.headers.set(key, value)
      }
      return response
    },

    snapshot() {
      return { cookies: [...refreshedCookies], headers: { ...suppliedHeaders } }
    },
  }
}

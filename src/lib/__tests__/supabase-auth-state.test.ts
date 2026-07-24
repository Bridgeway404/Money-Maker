import { describe, expect, it } from 'vitest'
import { createSupabaseAuthState } from '../auth/supabase-auth-state'
import type { CookieOptions } from '@supabase/ssr'

// The cache-protection headers @supabase/ssr documents as the second setAll
// argument whenever auth cookies are written.
const SUPABASE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
}

function mockResponse() {
  const cookies: { name: string; value: string; options?: CookieOptions }[] = []
  const headers = new Map<string, string>()
  return {
    cookies: {
      set(name: string, value: string, options?: CookieOptions) {
        cookies.push({ name, value, options })
      },
    },
    headers: {
      set(name: string, value: string) {
        headers.set(name, value)
      },
    },
    written: { cookies, headers },
  }
}

const REFRESH = [
  {
    name: 'sb-project-auth-token',
    value: 'refreshed-jwt',
    options: { httpOnly: true, maxAge: 3600, path: '/', sameSite: 'lax' } as CookieOptions,
  },
]

describe('supabase auth-state tracker', () => {
  it('records the exact refreshed-cookie records and supplied headers', () => {
    const state = createSupabaseAuthState()
    state.record(REFRESH, SUPABASE_CACHE_HEADERS)
    expect(state.hasRefreshedCookies).toBe(true)
    expect(state.snapshot()).toEqual({ cookies: REFRESH, headers: SUPABASE_CACHE_HEADERS })
  })

  it('applies cookies with their exact options — nothing lost or rewritten', () => {
    const state = createSupabaseAuthState()
    state.record(REFRESH, SUPABASE_CACHE_HEADERS)
    const res = state.applySupabaseAuthState(mockResponse())
    expect(res.written.cookies).toEqual([
      {
        name: 'sb-project-auth-token',
        value: 'refreshed-jwt',
        options: { httpOnly: true, maxAge: 3600, path: '/', sameSite: 'lax' },
      },
    ])
  })

  it('applies every supplied header (Cache-Control, Expires, Pragma) to the response', () => {
    const state = createSupabaseAuthState()
    state.record(REFRESH, SUPABASE_CACHE_HEADERS)
    const res = state.applySupabaseAuthState(mockResponse())
    expect(res.written.headers.get('Cache-Control')).toBe(SUPABASE_CACHE_HEADERS['Cache-Control'])
    expect(res.written.headers.get('Expires')).toBe('0')
    expect(res.written.headers.get('Pragma')).toBe('no-cache')
  })

  it('invariant: a response receiving refreshed cookies always receives the supplied cache headers too', () => {
    const state = createSupabaseAuthState()
    state.record(REFRESH, SUPABASE_CACHE_HEADERS)
    const res = state.applySupabaseAuthState(mockResponse())
    // Both written by the same call — cookies can never be applied without
    // the headers recorded alongside them.
    expect(res.written.cookies.length).toBeGreaterThan(0)
    expect(res.written.headers.size).toBe(Object.keys(SUPABASE_CACHE_HEADERS).length)
  })

  it('is a safe no-op when nothing was refreshed', () => {
    const state = createSupabaseAuthState()
    expect(state.hasRefreshedCookies).toBe(false)
    const res = state.applySupabaseAuthState(mockResponse())
    expect(res.written.cookies).toEqual([])
    expect(res.written.headers.size).toBe(0)
  })

  it('accumulates multiple setAll invocations, later headers winning', () => {
    const state = createSupabaseAuthState()
    state.record([{ name: 'a', value: '1', options: {} }], { Pragma: 'no-cache' })
    state.record([{ name: 'b', value: '2', options: {} }], { Pragma: 'no-cache', Expires: '0' })
    const res = state.applySupabaseAuthState(mockResponse())
    expect(res.written.cookies.map((c) => c.name)).toEqual(['a', 'b'])
    expect(res.written.headers.get('Expires')).toBe('0')
  })
})

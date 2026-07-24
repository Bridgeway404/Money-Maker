import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CookieOptions } from '@supabase/ssr'

// Controlled mocked-refresh tests of the REAL proxy: @supabase/ssr is
// mocked so getUser() triggers the proxy's own setAll callback with
// refreshed cookies plus the library's documented cache-protection
// headers — no real Supabase service is contacted. This proves every
// response class (pass-through AND both redirects) carries the refreshed
// cookies and the no-store headers.

const SUPABASE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
}

const REFRESHED = {
  name: 'sb-test-auth-token',
  value: 'refreshed-jwt',
  options: { httpOnly: true, path: '/', maxAge: 3600 } as CookieOptions,
}

type SetAll = (
  cookies: { name: string; value: string; options: CookieOptions }[],
  headers: Record<string, string>
) => void

let capturedSetAll: SetAll | undefined
let userForThisTest: { id: string } | null = null
let refreshDuringGetUser = true

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { getAll: () => unknown; setAll: SetAll } }
  ) => {
    capturedSetAll = opts.cookies.setAll
    return {
      auth: {
        async getUser() {
          if (refreshDuringGetUser) {
            // Exactly what @supabase/ssr does on a session refresh.
            capturedSetAll!([REFRESHED], SUPABASE_CACHE_HEADERS)
          }
          return { data: { user: userForThisTest } }
        },
      },
    }
  },
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.example.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'stub-anon-key'

const { proxy } = await import('../../proxy')
const { NextRequest } = await import('next/server')

function expectAuthState(res: { cookies: { get(n: string): { value: string } | undefined }; headers: Headers }) {
  expect(res.cookies.get(REFRESHED.name)?.value).toBe(REFRESHED.value)
  expect(res.headers.get('Cache-Control')).toBe(SUPABASE_CACHE_HEADERS['Cache-Control'])
  expect(res.headers.get('Expires')).toBe('0')
  expect(res.headers.get('Pragma')).toBe('no-cache')
}

describe('proxy carries refreshed Supabase auth state on every response', () => {
  beforeEach(() => {
    capturedSetAll = undefined
    userForThisTest = null
    refreshDuringGetUser = true
  })

  it('setAll is wired with the two-argument (cookies, headers) contract', async () => {
    await proxy(new NextRequest('http://localhost/'))
    expect(capturedSetAll).toBeTypeOf('function')
    expect(capturedSetAll!.length).toBe(2)
  })

  it('pass-through response receives refreshed cookies AND the supplied cache headers', async () => {
    userForThisTest = { id: 'user-1' }
    const res = await proxy(new NextRequest('http://localhost/dashboard'))
    expect(res.status).toBe(200)
    expectAuthState(res)
  })

  it('login redirect (anonymous on protected path) preserves refreshed cookies and headers', async () => {
    userForThisTest = null
    const res = await proxy(new NextRequest('http://localhost/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?redirectTo=%2Fdashboard')
    expectAuthState(res)
  })

  it('dashboard redirect (authenticated on /login) preserves refreshed cookies and headers', async () => {
    userForThisTest = { id: 'user-1' }
    const res = await proxy(new NextRequest('http://localhost/login'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/dashboard')
    expectAuthState(res)
  })

  it('cookie options survive onto the redirect (httpOnly, path, maxAge)', async () => {
    userForThisTest = null
    const res = await proxy(new NextRequest('http://localhost/settings'))
    const cookie = res.cookies.get(REFRESHED.name)
    expect(cookie).toMatchObject({ value: REFRESHED.value, httpOnly: true, path: '/', maxAge: 3600 })
  })

  it('no-refresh requests behave exactly as before (no stray cookies or headers)', async () => {
    refreshDuringGetUser = false
    userForThisTest = null
    const res = await proxy(new NextRequest('http://localhost/login'))
    expect(res.status).toBe(200)
    expect(res.cookies.get(REFRESHED.name)).toBeUndefined()
    expect(res.headers.get('Pragma')).toBeNull()
  })

  it('route decisions are unchanged: anonymous public passes, protected redirects', async () => {
    userForThisTest = null
    expect((await proxy(new NextRequest('http://localhost/'))).status).toBe(200)
    expect((await proxy(new NextRequest('http://localhost/signup'))).status).toBe(200)
    const redirected = await proxy(new NextRequest('http://localhost/research/AAPL'))
    expect(redirected.headers.get('location')).toBe(
      'http://localhost/login?redirectTo=%2Fresearch%2FAAPL'
    )
  })
})

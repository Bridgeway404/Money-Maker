import { describe, expect, it } from 'vitest'
import { AUTH_PAGES, PROTECTED_PATHS, decideRoute } from '../auth/route-access'

// The auth gate's decision table. These rules must survive framework
// upgrades unchanged — the proxy delegates every routing decision here.

describe('route access decisions (auth proxy)', () => {
  it.each([...PROTECTED_PATHS])(
    'anonymous user is redirected from %s to login with redirectTo',
    (path) => {
      expect(decideRoute(path, false)).toEqual({
        action: 'redirect-login',
        redirectTo: path,
      })
    }
  )

  it('anonymous redirect preserves nested paths', () => {
    expect(decideRoute('/research/AAPL', false)).toEqual({
      action: 'redirect-login',
      redirectTo: '/research/AAPL',
    })
    expect(decideRoute('/leaps/MSFT', false)).toEqual({
      action: 'redirect-login',
      redirectTo: '/leaps/MSFT',
    })
  })

  it.each([...PROTECTED_PATHS])('authenticated user is allowed through %s', (path) => {
    expect(decideRoute(path, true)).toEqual({ action: 'allow' })
  })

  it.each([...AUTH_PAGES])('%s stays public for anonymous users', (path) => {
    expect(decideRoute(path, false)).toEqual({ action: 'allow' })
  })

  it.each([...AUTH_PAGES])(
    'authenticated user is redirected away from %s to the dashboard',
    (path) => {
      expect(decideRoute(path, true)).toEqual({ action: 'redirect-dashboard' })
    }
  )

  it('the landing page is public for everyone', () => {
    expect(decideRoute('/', false)).toEqual({ action: 'allow' })
    expect(decideRoute('/', true)).toEqual({ action: 'allow' })
  })

  it('unknown public paths pass through for anonymous users', () => {
    expect(decideRoute('/pricing', false)).toEqual({ action: 'allow' })
  })

  it('prefix matching does not leak: /log is not /login, /dash is not protected', () => {
    expect(decideRoute('/log', true)).toEqual({ action: 'allow' })
    expect(decideRoute('/dash', false)).toEqual({ action: 'allow' })
  })
})

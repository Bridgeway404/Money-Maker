// Route-access decisions for the auth proxy (formerly middleware).
// Pure logic, extracted so the redirect rules are unit-testable and cannot
// silently drift during framework upgrades.

export const PROTECTED_PATHS = [
  '/dashboard',
  '/onboarding',
  '/watchlist',
  '/portfolio',
  '/screener',
  '/research',
  '/leaps',
  '/settings',
] as const

export const AUTH_PAGES = ['/login', '/signup'] as const

export type RouteDecision =
  | { action: 'allow' }
  | { action: 'redirect-login'; redirectTo: string }
  | { action: 'redirect-dashboard' }

export function decideRoute(pathname: string, isAuthenticated: boolean): RouteDecision {
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (!isAuthenticated && isProtected) {
    return { action: 'redirect-login', redirectTo: pathname }
  }

  if (isAuthenticated && (AUTH_PAGES as readonly string[]).includes(pathname)) {
    return { action: 'redirect-dashboard' }
  }

  return { action: 'allow' }
}

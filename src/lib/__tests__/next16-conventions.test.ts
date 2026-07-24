import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Static guards for the Next.js 16 upgrade: the conventions this PR
// migrated to must not silently regress, and no deprecated configuration
// may creep back in.

const root = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))

describe('Next.js 16 conventions', () => {
  it('exactly one auth gate exists: src/proxy.ts (no middleware.ts anywhere, no root proxy.ts)', () => {
    expect(existsSync(join(root, 'src', 'proxy.ts'))).toBe(true)
    expect(existsSync(join(root, 'middleware.ts'))).toBe(false)
    expect(existsSync(join(root, 'src', 'middleware.ts'))).toBe(false)
    // Root-level proxy.ts is silently IGNORED with a src/ app dir —
    // verified empirically during the upgrade. It must never come back.
    expect(existsSync(join(root, 'proxy.ts'))).toBe(false)
  })

  it('the proxy preserves the auth-critical behavior markers', () => {
    const proxy = read('src/proxy.ts')
    expect(proxy).toContain('export async function proxy(')
    expect(proxy).toContain('createServerClient')
    expect(proxy).toContain('auth.getUser()')
    expect(proxy).toContain('getAll()')
    expect(proxy).toContain('setAll(')
    expect(proxy).toContain("from '@/lib/auth/route-access'")
    expect(proxy).toContain("loginUrl.searchParams.set('redirectTo'")
    // Matcher unchanged from the Next 14 middleware.
    expect(proxy).toContain(
      "'/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'"
    )
  })

  it('async request APIs: the Supabase server client awaits cookies()', () => {
    const server = read('src/lib/supabase/server.ts')
    expect(server).toContain('await cookies()')
  })

  it('dynamic pages use Promise-typed params', () => {
    for (const p of [
      'src/app/(protected)/research/[ticker]/page.tsx',
      'src/app/(protected)/leaps/[ticker]/page.tsx',
    ]) {
      const page = read(p)
      expect(page).toContain('params: Promise<')
      expect(page).toMatch(/use\(params\)/)
    }
  })

  it('next lint is gone: ESLint CLI + flat config only', () => {
    expect(pkg.scripts.lint).toBe('eslint .')
    expect(JSON.stringify(pkg.scripts)).not.toContain('next lint')
    expect(existsSync(join(root, 'eslint.config.mjs'))).toBe(true)
    expect(existsSync(join(root, '.eslintrc.json'))).toBe(false)
    for (const wf of ['.github/workflows/ci.yml', '.github/workflows/neon-development-validation.yml']) {
      expect(read(wf)).not.toContain('next lint')
    }
  })

  it('no deprecated Next.js configuration remains', () => {
    const config = read('next.config.mjs')
    expect(config).toContain('serverExternalPackages')
    expect(config).not.toContain('serverComponentsExternalPackages')
    expect(config).not.toContain('experimental')
  })

  it('Node 22 is pinned consistently', () => {
    expect(pkg.engines?.node).toBe('22.x')
    expect(read('.nvmrc').trim()).toBe('22')
    for (const wf of ['.github/workflows/ci.yml', '.github/workflows/neon-development-validation.yml']) {
      expect(read(wf)).toContain('node-version: 22')
      expect(read(wf)).not.toContain('node-version: 20')
    }
  })

  it('framework versions: Next 16 stable with React 19 (no canary)', () => {
    expect(pkg.dependencies.next).toMatch(/^16\.\d+\.\d+$/)
    expect(pkg.dependencies.react).toMatch(/\^19\./)
    expect(pkg.dependencies['react-dom']).toMatch(/\^19\./)
    expect(pkg.dependencies.next).not.toMatch(/canary|rc|beta/)
  })

  it('no runtime code imports Neon Auth and Supabase stays the auth provider', () => {
    expect(pkg.dependencies['@neondatabase/auth']).toBeUndefined()
    expect(pkg.devDependencies['@neondatabase/auth']).toBeUndefined()
    expect(pkg.dependencies['@supabase/supabase-js']).toBeDefined()
    expect(pkg.dependencies['@supabase/ssr']).toBeDefined()
  })

  it('the Neon validation workflow is still manual-only', () => {
    const wf = read('.github/workflows/neon-development-validation.yml')
    expect(wf).toContain('workflow_dispatch')
    for (const trigger of ['push:', 'pull_request:', 'schedule:', 'repository_dispatch:', 'workflow_run:']) {
      expect(wf).not.toContain(trigger)
    }
  })
})

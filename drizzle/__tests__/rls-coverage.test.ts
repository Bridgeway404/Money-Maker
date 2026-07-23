import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Static assertions over the committed migration SQL. These do not replace
// the database-backed suite (rls.db.test.ts) — they guarantee that the SQL
// we ship cannot silently drop RLS coverage for a table.

const migrationsDir = join(__dirname, '..', 'migrations')
const ddl = readFileSync(join(migrationsDir, '0000_iop_initial_schema.sql'), 'utf8')
const rls = readFileSync(join(migrationsDir, '0001_rls_policies.sql'), 'utf8')

const tables = Array.from(ddl.matchAll(/CREATE TABLE "([a-z_]+)"/g), (m) => m[1])

describe('RLS migration coverage', () => {
  it('discovers all 15 tables from the generated DDL', () => {
    expect(tables).toHaveLength(15)
    expect(tables).toContain('members')
    expect(tables).toContain('option_contracts')
  })

  it.each(tables)('%s has ENABLE and FORCE ROW LEVEL SECURITY', (t) => {
    expect(rls).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
    expect(rls).toContain(`ALTER TABLE public.${t} FORCE ROW LEVEL SECURITY;`)
  })

  it.each(tables)('%s is covered by the privileged_server_path policy loop', (t) => {
    const arrayBlock = rls.match(/FOREACH t IN ARRAY ARRAY\[([\s\S]*?)\]/)?.[1] ?? ''
    expect(arrayBlock).toContain(`'${t}'`)
  })

  it.each(tables)('%s has at least one policy for authenticated', (t) => {
    const policies = Array.from(
      rls.matchAll(
        new RegExp(`CREATE POLICY [a-z_]+ ON public\\.${t}\\b[\\s\\S]*?;`, 'g')
      )
    ).filter((m) => m[0].includes('TO authenticated'))
    expect(policies.length, `no authenticated policy found for ${t}`).toBeGreaterThan(0)
  })

  it('every INSERT or FOR ALL policy carries WITH CHECK', () => {
    const writePolicies = Array.from(
      rls.matchAll(/CREATE POLICY [a-z_]+ ON public\.[a-z_]+\s+FOR (INSERT|ALL) TO authenticated[\s\S]*?;/g)
    )
    expect(writePolicies.length).toBeGreaterThan(0)
    for (const [text] of writePolicies) {
      expect(text, `missing WITH CHECK in: ${text.slice(0, 80)}`).toContain('WITH CHECK')
    }
  })

  it('never references Supabase auth.uid() or auth.role()', () => {
    expect(rls).not.toContain('auth.uid()')
    expect(rls).not.toContain('auth.role()')
    expect(ddl).not.toContain('auth.uid()')
  })

  it('grants nothing to anonymous', () => {
    expect(rls).not.toMatch(/GRANT[^;]*TO\s+anonymous/i)
  })

  it('strict privacy: channel read paths never consult is_admin', () => {
    for (const name of [
      'channels_select_visible',
      'channel_messages_select_in_channel',
      'conversation_threads_select_in_channel',
    ]) {
      const policy = rls.match(
        new RegExp(`CREATE POLICY ${name}[\\s\\S]*?;`)
      )?.[0]
      expect(policy, `${name} not found`).toBeTruthy()
      expect(policy).not.toContain('is_admin')
    }
    const canRead = rls.match(/CREATE OR REPLACE FUNCTION iop\.can_read_channel[\s\S]*?\$\$;/)?.[0]
    expect(canRead).toBeTruthy()
    expect(canRead).not.toContain('is_admin')
  })

  it('member profile updates are column-limited to display_name', () => {
    expect(rls).toContain('GRANT UPDATE (display_name) ON public.members TO authenticated;')
    expect(rls).not.toMatch(/GRANT[^;(]*\bUPDATE\b[^;(]*ON public\.members/)
  })

  it('helper functions pin search_path and are SECURITY DEFINER', () => {
    const fns = Array.from(rls.matchAll(/CREATE OR REPLACE FUNCTION iop\.[\s\S]*?\$\$;/g))
    expect(fns).toHaveLength(4)
    for (const [text] of fns) {
      expect(text).toContain('SECURITY DEFINER')
      expect(text).toContain('SET search_path = public, pg_temp')
    }
  })

  it('the mock-only CHECK constraint is present in the DDL', () => {
    expect(ddl).toContain('"option_contracts"."is_mock" = true')
  })

  it('the data_reliability enum has no "live" value', () => {
    const enumLine = ddl.match(/CREATE TYPE "public"\."data_reliability" AS ENUM\((.*?)\);/)?.[1] ?? ''
    expect(enumLine).toContain("'mock'")
    expect(enumLine).not.toContain("'live'")
  })
})

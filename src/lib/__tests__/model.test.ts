import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, resolveModelId } from '@/lib/ai/model'

describe('resolveModelId', () => {
  it('falls back to the default when unset', () => {
    expect(resolveModelId(undefined)).toBe(DEFAULT_MODEL)
    expect(resolveModelId(null)).toBe(DEFAULT_MODEL)
    expect(resolveModelId('')).toBe(DEFAULT_MODEL)
  })

  it('accepts well-formed Claude model ids', () => {
    expect(resolveModelId('claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
    expect(resolveModelId('claude-opus-4-8')).toBe('claude-opus-4-8')
    expect(resolveModelId('  claude-haiku-4-5  ')).toBe('claude-haiku-4-5')
  })

  it('rejects malformed or non-Claude ids', () => {
    expect(resolveModelId('gpt-4o')).toBe(DEFAULT_MODEL)
    expect(resolveModelId('claude')).toBe(DEFAULT_MODEL)
    expect(resolveModelId('claude-sonnet-4-6; rm -rf /')).toBe(DEFAULT_MODEL)
    expect(resolveModelId('claude-' + 'x'.repeat(100))).toBe(DEFAULT_MODEL)
  })
})

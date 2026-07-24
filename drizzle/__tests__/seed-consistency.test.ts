import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOCK_OPTION_CONTRACTS } from '@/lib/utils/mock-data'

// The DB seed JSON must stay byte-for-byte consistent with the in-app mock
// data so the app renders the same contracts whether it reads the database
// or the local fallback.

const seedPath = join(__dirname, '..', 'seed', 'mock-option-contracts.json')
const seeded: Record<string, unknown>[] = JSON.parse(readFileSync(seedPath, 'utf8'))

const appContracts = Object.values(MOCK_OPTION_CONTRACTS)
  .flat()
  // The DB generates its own uuid ids; the app fallback uses 'mock-*' ids.
  .map(({ id: _id, ...rest }) => rest)

describe('mock seed consistency', () => {
  it('has exactly the 21 contracts the app ships', () => {
    expect(seeded).toHaveLength(21)
    expect(appContracts).toHaveLength(21)
  })

  it('matches src/lib/utils/mock-data.ts field-for-field', () => {
    expect(seeded).toEqual(appContracts)
  })

  it('every seeded row is explicitly mock', () => {
    for (const row of seeded) {
      expect(row.is_mock).toBe(true)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { buildOnboardingUpsert } from '@/lib/settings/onboarding'

const CHANGES = {
  purchasing_power: '$5k-$25k',
  industries: ['Technology', 'Healthcare'],
  risk_appetite: 'Moderate',
  priority: 'Company Quality',
}

describe('buildOnboardingUpsert', () => {
  it('preserves the existing watching_stocks list (regression: settings save wiped it)', () => {
    const row = buildOnboardingUpsert(
      'user-1',
      { watching_stocks: ['AAPL', 'MSFT', 'NVDA'] },
      CHANGES
    )
    expect(row.watching_stocks).toEqual(['AAPL', 'MSFT', 'NVDA'])
    expect(row.purchasing_power).toBe('$5k-$25k')
    expect(row.industries).toEqual(['Technology', 'Healthcare'])
  })

  it('defaults watching_stocks to [] when there is no existing row', () => {
    expect(buildOnboardingUpsert('user-1', null, CHANGES).watching_stocks).toEqual([])
    expect(buildOnboardingUpsert('user-1', undefined, CHANGES).watching_stocks).toEqual([])
    expect(
      buildOnboardingUpsert('user-1', { watching_stocks: undefined }, CHANGES).watching_stocks
    ).toEqual([])
  })

  it('applies every edited field and the user id', () => {
    const row = buildOnboardingUpsert('user-42', { watching_stocks: [] }, CHANGES)
    expect(row).toEqual({
      user_id: 'user-42',
      purchasing_power: '$5k-$25k',
      industries: ['Technology', 'Healthcare'],
      risk_appetite: 'Moderate',
      priority: 'Company Quality',
      watching_stocks: [],
    })
  })
})

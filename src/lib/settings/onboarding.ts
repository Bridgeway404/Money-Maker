// Builds the onboarding_answers upsert payload for the Settings page.
//
// The pre-Phase-1 Settings save hardcoded watching_stocks: [], silently
// erasing the tickers a user entered during onboarding every time they saved
// any setting. This helper merges the edited fields over the existing row and
// preserves everything the Settings form does not edit.

export interface OnboardingRecord {
  user_id: string
  purchasing_power: string
  industries: string[]
  watching_stocks: string[]
  risk_appetite: string
  priority: string
}

export interface SettingsProfileChanges {
  purchasing_power: string
  industries: string[]
  risk_appetite: string
  priority: string
}

export function buildOnboardingUpsert(
  userId: string,
  existing: Partial<OnboardingRecord> | null | undefined,
  changes: SettingsProfileChanges
): OnboardingRecord {
  return {
    user_id: userId,
    purchasing_power: changes.purchasing_power,
    industries: changes.industries,
    risk_appetite: changes.risk_appetite,
    priority: changes.priority,
    // Preserved, not edited by Settings:
    watching_stocks: Array.isArray(existing?.watching_stocks)
      ? existing.watching_stocks
      : [],
  }
}

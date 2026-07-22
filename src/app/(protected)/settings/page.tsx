'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { DEFAULT_WEIGHTS } from '@/lib/scoring'
import { buildOnboardingUpsert } from '@/lib/settings/onboarding'
import type { ScoringWeights, PurchasingPower, RiskAppetite, Priority, Industry } from '@/types'

const INDUSTRIES: { value: string; label: string }[] = [
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Semiconductors', label: 'Semiconductors' },
  { value: 'Industrials', label: 'Industrials' },
  { value: 'Consumer Products', label: 'Consumer Products' },
  { value: 'Financial', label: 'Financial' },
]

interface Slider {
  key: keyof ScoringWeights
  label: string
  description: string
  max: number
}

const SLIDERS: Slider[] = [
  {
    key: 'industry_leadership',
    label: 'Industry Leadership',
    description: 'Weight for being in top 2-3 by market cap',
    max: 40,
  },
  {
    key: 'cash_flow',
    label: 'Cash Flow Strength',
    description: 'Weight for strong free cash flow generation',
    max: 35,
  },
  {
    key: 'earnings_quality',
    label: 'Earnings Quality',
    description: 'Weight for growing, consistent earnings',
    max: 35,
  },
  {
    key: 'debt_to_equity',
    label: 'Debt-to-Equity',
    description: 'Weight for low leverage (lower D/E = better)',
    max: 20,
  },
  {
    key: 'ema_distance',
    label: '200-Week EMA Distance',
    description: 'Weight for trading near 200-week EMA',
    max: 25,
  },
  {
    key: 'option_affordability',
    label: 'Option Affordability',
    description: 'Weight for options fitting within purchasing power',
    max: 15,
  },
  {
    key: 'option_expiration',
    label: 'Option Expiration',
    description: 'Weight for 12+ month expirations',
    max: 15,
  },
]

export default function SettingsPage() {
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS)
  const [purchasingPower, setPurchasingPower] = useState<PurchasingPower>('$5k-$25k')
  const [riskAppetite, setRiskAppetite] = useState<RiskAppetite>('Moderate')
  const [priority, setPriority] = useState<Priority>('Company Quality')
  const [selectedIndustries, setSelectedIndustries] = useState<Industry[]>(['Technology', 'Semiconductors'])
  const [watchingStocks, setWatchingStocks] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: config }, { data: onboarding }] = await Promise.all([
      supabase.from('scoring_config').select('weights').eq('user_id', user.id).single(),
      supabase.from('onboarding_answers').select('*').eq('user_id', user.id).single(),
    ])

    if (config?.weights) setWeights(config.weights as ScoringWeights)
    if (onboarding) {
      setPurchasingPower(onboarding.purchasing_power as PurchasingPower)
      setRiskAppetite(onboarding.risk_appetite as RiskAppetite)
      setPriority(onboarding.priority as Priority)
      setSelectedIndustries(onboarding.industries as Industry[])
      // Keep the onboarding watchlist so saving Settings never erases it.
      setWatchingStocks(
        Array.isArray(onboarding.watching_stocks) ? onboarding.watching_stocks : []
      )
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaveError(null)

    const total = Object.values(weights).reduce((a, b) => a + b, 0)
    if (total !== 100) {
      setSaveError(`Scoring weights must total exactly 100 (currently ${total}). Adjust the sliders before saving.`)
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const onboardingRow = buildOnboardingUpsert(
      user.id,
      { watching_stocks: watchingStocks },
      {
        purchasing_power: purchasingPower,
        industries: selectedIndustries,
        risk_appetite: riskAppetite,
        priority,
      }
    )

    const [configResult, onboardingResult] = await Promise.all([
      supabase
        .from('scoring_config')
        .upsert({ user_id: user.id, weights })
        .eq('user_id', user.id),
      supabase.from('onboarding_answers').upsert(onboardingRow),
    ])

    setSaving(false)
    if (configResult.error || onboardingResult.error) {
      setSaveError('Failed to save settings. Please try again.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function resetWeights() {
    setWeights(DEFAULT_WEIGHTS)
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <Header
        title="Settings"
        description="Customize your scoring weights and profile preferences."
      />

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading settings...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile settings */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Settings className="h-4 w-4 text-zinc-400" />
              <h3 className="text-base font-semibold text-zinc-100">Profile Preferences</h3>
            </div>
            <div className="space-y-4">
              <Select
                label="Purchasing Power"
                value={purchasingPower}
                onChange={(e) => setPurchasingPower(e.target.value as PurchasingPower)}
                options={[
                  { value: '<$1k', label: 'Under $1,000' },
                  { value: '$1k-$5k', label: '$1,000 – $5,000' },
                  { value: '$5k-$25k', label: '$5,000 – $25,000' },
                  { value: '$25k-$100k', label: '$25,000 – $100,000' },
                  { value: '$100k+', label: '$100,000+' },
                ]}
              />
              <Select
                label="Risk Appetite"
                value={riskAppetite}
                onChange={(e) => setRiskAppetite(e.target.value as RiskAppetite)}
                options={[
                  { value: 'Conservative', label: 'Conservative' },
                  { value: 'Moderate', label: 'Moderate' },
                  { value: 'Aggressive', label: 'Aggressive' },
                ]}
              />
              <Select
                label="Top Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                options={[
                  { value: 'Affordability', label: 'Affordability' },
                  { value: 'Upside Potential', label: 'Upside Potential' },
                  { value: 'Company Quality', label: 'Company Quality' },
                ]}
              />
              <div>
                <p className="text-sm font-medium text-zinc-300 mb-2">Industries of Interest</p>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRIES.map(({ value }) => {
                    const active = selectedIndustries.includes(value as Industry)
                    return (
                      <button
                        key={value}
                        onClick={() =>
                          setSelectedIndustries((prev) =>
                            active ? prev.filter((i) => i !== value) : [...prev, value as Industry]
                          )
                        }
                        className={`text-sm px-3 py-2 rounded-lg border transition-all ${
                          active
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Scoring weights */}
          <Card>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-zinc-100">Scoring Weights</h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-md font-mono ${
                  totalWeight === 100
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : 'bg-yellow-400/10 text-yellow-400'
                }`}>
                  Total: {totalWeight}/100
                </span>
                <button
                  onClick={resetWeights}
                  className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>
            </div>
            {totalWeight !== 100 && (
              <div className="mb-4 p-2 rounded-lg bg-yellow-400/5 border border-yellow-400/20 text-xs text-yellow-300">
                Weights must total exactly 100 — saving is blocked until they do.
              </div>
            )}
            <div className="space-y-5">
              {SLIDERS.map(({ key, label, description, max }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{label}</p>
                      <p className="text-xs text-zinc-500">{description}</p>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-400 ml-3 shrink-0">
                      {weights[key]} pts
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={max}
                    value={weights[key]}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [key]: parseInt(e.target.value) }))
                    }
                    className="w-full h-1.5 accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-700 mt-0.5">
                    <span>0</span>
                    <span>{max}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Save button */}
      <div className="flex flex-col items-end gap-2">
        {saveError && (
          <p className="text-sm text-rose-400">{saveError}</p>
        )}
        <Button onClick={handleSave} loading={saving} size="lg">
          {saved ? (
            <span className="text-emerald-300">Saved!</span>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

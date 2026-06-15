'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import type { PurchasingPower, Industry, RiskAppetite, Priority } from '@/types'

const INDUSTRIES: Industry[] = [
  'Healthcare',
  'Technology',
  'Semiconductors',
  'Industrials',
  'Consumer Products',
  'Financial',
]

const STEPS = ['Purchasing Power', 'Industries', 'Stocks Watching', 'Risk Appetite', 'Priority']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [purchasingPower, setPurchasingPower] = useState<PurchasingPower | ''>('')
  const [industries, setIndustries] = useState<Industry[]>([])
  const [watchingStocks, setWatchingStocks] = useState('')
  const [riskAppetite, setRiskAppetite] = useState<RiskAppetite | ''>('')
  const [priority, setPriority] = useState<Priority | ''>('')

  function toggleIndustry(ind: Industry) {
    setIndustries((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
    )
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return purchasingPower !== ''
      case 1:
        return industries.length > 0
      case 2:
        return true // optional
      case 3:
        return riskAppetite !== ''
      case 4:
        return priority !== ''
      default:
        return false
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const stocks = watchingStocks
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)

      const { error: dbError } = await supabase
        .from('onboarding_answers')
        .upsert({
          user_id: user.id,
          purchasing_power: purchasingPower,
          industries,
          watching_stocks: stocks,
          risk_appetite: riskAppetite,
          priority,
        })

      if (dbError) {
        setError('Failed to save your preferences. Please try again.')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-zinc-100">LEAPS AI</span>
      </div>

      {/* Progress */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center gap-2 mb-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step
                    ? 'bg-emerald-600 text-white'
                    : i === step
                    ? 'bg-emerald-600/20 border-2 border-emerald-500 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 transition-all ${
                    i < step ? 'bg-emerald-600' : 'bg-zinc-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-zinc-400 text-center">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>
      </div>

      {/* Step content */}
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        {/* Step 0: Purchasing Power */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-zinc-100">What is your purchasing power?</h2>
              <p className="text-sm text-zinc-400 mt-1">
                This helps us calibrate affordability scores for options recommendations.
              </p>
            </div>
            {(['<$1k', '$1k-$5k', '$5k-$25k', '$25k-$100k', '$100k+'] as PurchasingPower[]).map(
              (pp) => (
                <button
                  key={pp}
                  onClick={() => setPurchasingPower(pp)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    purchasingPower === pp
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {pp} available for options
                </button>
              )
            )}
          </div>
        )}

        {/* Step 1: Industries */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-zinc-100">Which industries interest you?</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Select all that apply. We focus on GDP-driving industries with industry leaders.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  onClick={() => toggleIndustry(ind)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    industries.includes(ind)
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {industries.includes(ind) && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  {ind}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Stocks watching */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-zinc-100">Which stocks are you watching?</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Enter tickers separated by commas. This is optional — you can add more later.
              </p>
            </div>
            <textarea
              value={watchingStocks}
              onChange={(e) => setWatchingStocks(e.target.value)}
              placeholder="AAPL, MSFT, NVDA, JPM..."
              rows={4}
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none uppercase"
              style={{ textTransform: 'uppercase' }}
            />
            <p className="text-xs text-zinc-500">Separate multiple tickers with commas</p>
          </div>
        )}

        {/* Step 3: Risk appetite */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-zinc-100">What is your risk appetite?</h2>
              <p className="text-sm text-zinc-400 mt-1">
                This influences how we present options recommendations and risk assessments.
              </p>
            </div>
            {[
              {
                value: 'Conservative' as RiskAppetite,
                label: 'Conservative',
                desc: 'Prefer deep ITM options with lower leverage',
              },
              {
                value: 'Moderate' as RiskAppetite,
                label: 'Moderate',
                desc: 'Balance between delta, premium, and upside',
              },
              {
                value: 'Aggressive' as RiskAppetite,
                label: 'Aggressive',
                desc: 'Willing to accept OTM options for maximum leverage',
              },
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setRiskAppetite(value)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  riskAppetite === value
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <p
                  className={`font-medium text-sm ${
                    riskAppetite === value ? 'text-emerald-300' : 'text-zinc-200'
                  }`}
                >
                  {label}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 4: Priority */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-zinc-100">What is your top priority?</h2>
              <p className="text-sm text-zinc-400 mt-1">
                This helps us weight recommendations toward what matters most to you.
              </p>
            </div>
            {[
              {
                value: 'Affordability' as Priority,
                label: 'Affordability',
                desc: 'Prioritize options that fit within my purchasing power',
              },
              {
                value: 'Upside Potential' as Priority,
                label: 'Upside Potential',
                desc: 'Maximize potential return, even at higher premium cost',
              },
              {
                value: 'Company Quality' as Priority,
                label: 'Company Quality',
                desc: 'Only the strongest businesses regardless of option pricing',
              },
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setPriority(value)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  priority === value
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <p
                  className={`font-medium text-sm ${
                    priority === value ? 'text-emerald-300' : 'text-zinc-200'
                  }`}
                >
                  {label}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-400/10 border border-rose-400/20">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex-1"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={loading}
              disabled={!canProceed()}
              className="flex-1"
            >
              Start Researching <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

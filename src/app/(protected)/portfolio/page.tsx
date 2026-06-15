'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, FormEvent } from 'react'
import { Briefcase, Trash2, Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import { formatCurrency } from '@/lib/utils/formatting'
import type { PortfolioHolding } from '@/types'

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')

  // Form state
  const [ticker, setTicker] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [shares, setShares] = useState('')
  const [avgCost, setAvgCost] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadHoldings()
  }, [])

  async function loadHoldings() {
    const supabase = createClient()
    setLoading(true)
    const { data } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .order('added_at', { ascending: false })
    setHoldings(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!ticker || !companyName || !shares || !avgCost) {
      setFormError('Ticker, company name, shares, and average cost are required.')
      return
    }

    setAdding(true)
    const supabase = createClient()
    const { error } = await supabase.from('portfolio_holdings').insert({
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      shares: parseFloat(shares),
      avg_cost: parseFloat(avgCost),
      current_value: currentValue ? parseFloat(currentValue) : null,
      notes: notes || null,
    })

    if (error) {
      setFormError(error.message)
    } else {
      setTicker('')
      setCompanyName('')
      setShares('')
      setAvgCost('')
      setCurrentValue('')
      setNotes('')
      setShowForm(false)
      await loadHoldings()
    }
    setAdding(false)
  }

  async function handleRemove(id: string) {
    const supabase = createClient()
    await supabase.from('portfolio_holdings').delete().eq('id', id)
    setHoldings((prev) => prev.filter((h) => h.id !== id))
  }

  // Summary calculations
  const totalInvested = holdings.reduce((sum, h) => sum + h.shares * h.avg_cost, 0)
  const totalCurrentValue = holdings.reduce((sum, h) => sum + (h.current_value ?? h.shares * h.avg_cost), 0)
  const totalGainLoss = totalCurrentValue - totalInvested
  const totalPct = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

  return (
    <div className="space-y-6">
      <Header
        title="Portfolio"
        description="Track your current holdings to help the AI understand your allocation."
        actions={
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            <Plus className="h-4 w-4" /> Add Holding
          </Button>
        }
      />

      {/* Summary cards */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Invested</p>
            <p className="text-2xl font-bold text-zinc-100">{formatCurrency(totalInvested)}</p>
            <p className="text-xs text-zinc-500 mt-1">{holdings.length} positions</p>
          </Card>
          <Card>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Est. Current Value</p>
            <p className="text-2xl font-bold text-zinc-100">{formatCurrency(totalCurrentValue)}</p>
          </Card>
          <Card>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Gain / Loss</p>
            <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(totalGainLoss)} ({totalPct >= 0 ? '+' : ''}{totalPct.toFixed(1)}%)
            </p>
            <div className="flex items-center gap-1 mt-1">
              {totalGainLoss >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-rose-400" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <Card>
          <h3 className="text-sm font-semibold text-zinc-100 mb-4">Add Holding</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              required
            />
            <Input
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Apple Inc."
              required
            />
            <Input
              label="Shares"
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="100"
              min="0.0001"
              step="0.0001"
              required
            />
            <Input
              label="Avg. Cost per Share"
              type="number"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="150.00"
              min="0.01"
              step="0.01"
              required
            />
            <Input
              label="Current Value (optional)"
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="Current share price × shares"
              hint="Leave blank to use cost basis as current value"
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why you hold this, entry thesis, etc."
                rows={2}
              />
            </div>
            {formError && (
              <div className="sm:col-span-2 p-3 rounded-lg bg-rose-400/10 border border-rose-400/20">
                <p className="text-sm text-rose-400">{formError}</p>
              </div>
            )}
            <div className="sm:col-span-2 flex gap-3">
              <Button type="submit" loading={adding}>
                Add Holding
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Holdings table */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">Loading portfolio...</div>
      ) : holdings.length === 0 ? (
        <Card className="text-center py-12">
          <Briefcase className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No holdings added yet.</p>
          <p className="text-zinc-600 text-xs mt-1">
            Add your positions so the AI can factor in concentration and allocation.
          </p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Ticker</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Company</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Shares</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Avg Cost</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Invested</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Est. Value</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {holdings.map((h) => {
                  const invested = h.shares * h.avg_cost
                  const currVal = h.current_value ?? invested
                  const pnl = currVal - invested
                  const pnlPct = (pnl / invested) * 100
                  return (
                    <tr key={h.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-5 py-3.5 font-mono font-bold text-zinc-100">{h.ticker}</td>
                      <td className="px-4 py-3.5 text-zinc-300">{h.company_name}</td>
                      <td className="px-4 py-3.5 text-right text-zinc-300">{h.shares.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right text-zinc-300">{formatCurrency(h.avg_cost)}</td>
                      <td className="px-4 py-3.5 text-right text-zinc-300">{formatCurrency(invested)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div>
                          <span className="text-zinc-300">{formatCurrency(currVal)}</span>
                          <span className={`text-xs ml-1.5 ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => handleRemove(h.id)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-zinc-700">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Total</td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-100">{formatCurrency(totalInvested)}</td>
                  <td className="px-4 py-3 text-right">
                    <div>
                      <span className="font-semibold text-zinc-100">{formatCurrency(totalCurrentValue)}</span>
                      <span className={`text-xs ml-1.5 ${totalGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ({totalPct >= 0 ? '+' : ''}{totalPct.toFixed(1)}%)
                      </span>
                    </div>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {holdings.length > 0 && (
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-sm text-zinc-400 leading-relaxed">
          <p className="font-medium text-zinc-300 mb-1">AI Allocation Note</p>
          <p>
            Your portfolio shows {holdings.length} position{holdings.length !== 1 ? 's' : ''} with{' '}
            {formatCurrency(totalInvested)} invested. When requesting LEAPS recommendations, the AI
            will consider your existing positions to avoid concentration in the same sectors or names.
            Adding LEAPS options amplifies exposure — factor this into your total risk picture.
          </p>
        </div>
      )}
    </div>
  )
}

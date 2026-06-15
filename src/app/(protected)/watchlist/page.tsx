'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, FormEvent } from 'react'
import { Star, Trash2, Plus, ArrowUpDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import type { WatchlistItem, Industry } from '@/types'

const INDUSTRIES: { value: string; label: string }[] = [
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Semiconductors', label: 'Semiconductors' },
  { value: 'Industrials', label: 'Industrials' },
  { value: 'Consumer Products', label: 'Consumer Products' },
  { value: 'Financial', label: 'Financial' },
]

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filterIndustry, setFilterIndustry] = useState('')
  const [sortBy, setSortBy] = useState<'confidence' | 'ticker' | 'date'>('date')

  // Form state
  const [ticker, setTicker] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState<Industry>('Technology')
  const [notes, setNotes] = useState('')
  const [confidence, setConfidence] = useState(3)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadWatchlist()
  }, [])

  async function loadWatchlist() {
    const supabase = createClient()
    setLoading(true)
    const { data } = await supabase
      .from('watchlist_items')
      .select('*')
      .order('added_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!ticker || !companyName) {
      setFormError('Ticker and company name are required.')
      return
    }

    setAdding(true)
    const supabase = createClient()
    const { error } = await supabase.from('watchlist_items').insert({
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      industry,
      notes: notes || null,
      confidence_level: confidence,
    })

    if (error) {
      setFormError(error.message.includes('unique') ? `${ticker.toUpperCase()} is already in your watchlist.` : error.message)
    } else {
      setTicker('')
      setCompanyName('')
      setNotes('')
      setConfidence(3)
      setShowForm(false)
      await loadWatchlist()
    }
    setAdding(false)
  }

  async function handleRemove(id: string) {
    const supabase = createClient()
    await supabase.from('watchlist_items').delete().eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const filtered = items
    .filter((i) => !filterIndustry || i.industry === filterIndustry)
    .sort((a, b) => {
      if (sortBy === 'confidence') return b.confidence_level - a.confidence_level
      if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker)
      return new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
    })

  return (
    <div className="space-y-6">
      <Header
        title="Watchlist"
        description="Track stocks you are monitoring for LEAPS opportunities."
        actions={
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            <Plus className="h-4 w-4" /> Add Stock
          </Button>
        }
      />

      {/* Add form */}
      {showForm && (
        <Card>
          <h3 className="text-sm font-semibold text-zinc-100 mb-4">Add to Watchlist</h3>
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
            <Select
              label="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value as Industry)}
              options={INDUSTRIES}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-300">
                Confidence (1–5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setConfidence(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      confidence === n
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why are you watching this stock?"
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
                Add to Watchlist
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Select
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
          options={[{ value: '', label: 'All Industries' }, ...INDUSTRIES]}
          className="w-44"
        />
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs text-zinc-500">Sort by:</span>
          {(['date', 'confidence', 'ticker'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                sortBy === s
                  ? 'text-emerald-400 bg-emerald-400/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-600 ml-auto">{filtered.length} stocks</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">Loading watchlist...</div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <Star className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Your watchlist is empty.</p>
          <p className="text-zinc-600 text-xs mt-1">Add stocks you want to track for LEAPS opportunities.</p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Ticker</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Industry</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Confidence</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-5 py-3.5 font-mono font-bold text-zinc-100">{item.ticker}</td>
                    <td className="px-4 py-3.5 text-zinc-300">{item.company_name}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant="outline">{item.industry}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3 w-3 ${
                              n <= item.confidence_level ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 max-w-xs truncate">{item.notes || '—'}</td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getUserMock, createMock, insertMock, analysisRef } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createMock: vi.fn(),
  insertMock: vi.fn(),
  analysisRef: { data: { score: { total: 88 } } as unknown },
}))

vi.mock('@/lib/ai/client', () => ({
  anthropic: { messages: { create: (...args: unknown[]) => createMock(...args) } },
  MODEL_ID: 'test-model',
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'stock_analyses') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => chain
        chain.order = () => chain
        chain.limit = () => chain
        chain.maybeSingle = async () => analysisRef
        return chain
      }
      return {
        insert: (row: unknown) => {
          insertMock(table, row)
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'l1', ...(row as Record<string, unknown>), generated_at: '2027-01-01T00:00:00Z' },
                error: null,
              }),
            }),
          }
        },
      }
    },
  }),
}))

function aiText(obj: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] }
}

const MOCK_CONTRACT = {
  id: 'mock-aapl-1',
  ticker: 'AAPL',
  option_type: 'CALL',
  expiration_date: '2027-01-15',
  strike_price: 200,
  current_premium: 18.5,
  all_time_high_premium: 32,
  depreciation_pct: 42.19,
  implied_volatility: 0.285,
  delta: 0.52,
  theta: -0.045,
  volume: 1250,
  open_interest: 8500,
  is_mock: true,
}

const REQUEST_BODY = { ticker: 'AAPL', company_name: 'Apple Inc.', contracts: [MOCK_CONTRACT] }

function validRec() {
  return {
    recommendations: [
      {
        rank: 1,
        is_front_runner: true,
        contract_index: 1,
        ai_reasoning: 'Long expiration and a delta near 0.50 make this the strongest of the set.',
        risk_level: 'Medium',
        affordability: 'Affordable',
        score: 82,
      },
    ],
    front_runner_explanation: 'The single contract clears the framework on delta and time to expiration.',
  }
}

async function callLeaps(body: unknown) {
  const { POST } = await import('@/app/api/leaps/route')
  const req = new NextRequest('http://localhost/api/leaps', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  const res = await POST(req)
  const json = await res.json()
  return { status: res.status, json }
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } })
  createMock.mockReset()
  insertMock.mockReset()
  analysisRef.data = { score: { total: 88 } }
})

describe('POST /api/leaps — AI-response safety', () => {
  it('persists and returns a valid ranking', async () => {
    createMock.mockResolvedValue(aiText(validRec()))
    const { status, json } = await callLeaps(REQUEST_BODY)
    expect(status).toBe(200)
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock.mock.calls[0][0]).toBe('leaps_recommendations')
    expect(json.error).toBeUndefined()
  })

  it('returns a generic 502 with NO internal details when the AI index is out of range', async () => {
    const bad = validRec()
    bad.recommendations[0].contract_index = 5 // only 1 contract exists
    createMock.mockResolvedValue(aiText(bad))
    const { status, json } = await callLeaps(REQUEST_BODY)
    expect(status).toBe(502)
    expect(json.error).toBe('ai_response_invalid')
    // No validation structure, model output, or provider detail leaks.
    expect(json.details).toBeUndefined()
    expect(json.errors).toBeUndefined()
    expect(Object.keys(json).sort()).toEqual(['error', 'message'])
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 502 and does NOT persist on malformed JSON', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: '```json\nnope' }] })
    const { status, json } = await callLeaps(REQUEST_BODY)
    expect(status).toBe(502)
    expect(json.error).toBe('ai_response_invalid')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 409 analysis_required and never calls the model when no stored analysis exists', async () => {
    analysisRef.data = null
    createMock.mockResolvedValue(aiText(validRec()))
    const { status, json } = await callLeaps(REQUEST_BODY)
    expect(status).toBe(409)
    expect(json.error).toBe('analysis_required')
    expect(createMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })
})

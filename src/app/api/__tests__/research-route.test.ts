import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Hoisted mocks so the module factories below can reference them.
const { getUserMock, createMock, insertMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createMock: vi.fn(),
  insertMock: vi.fn(),
}))

// Prevent the real Anthropic client (which throws without an API key at import)
// from loading, and let each test control the model output.
vi.mock('@/lib/ai/client', () => ({
  anthropic: { messages: { create: (...args: unknown[]) => createMock(...args) } },
  MODEL_ID: 'test-model',
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => ({
      insert: (row: unknown) => {
        insertMock(table, row)
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'r1', ...(row as Record<string, unknown>), generated_at: '2027-01-01T00:00:00Z' },
              error: null,
            }),
          }),
        }
      },
    }),
  }),
}))

function aiText(obj: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] }
}

function validNarrative(overrides: Record<string, unknown> = {}) {
  return {
    overview: 'A large-cap technology company with a diversified revenue base and durable moat.',
    industry_position: 'Among the leaders in its sector by most reasonable measures.',
    cash_flow_analysis: 'The supplied cash-flow rating suggests durable generation.',
    earnings_analysis: 'The supplied earnings trend implies steady profitability.',
    debt_analysis: 'A manageable balance sheet at the supplied debt level.',
    technical_analysis: 'Trading near its 200-week EMA per the supplied inputs.',
    bull_case: '• Strong franchise\n• Durable cash flow',
    bear_case: '• Rich valuation\n• Competitive pressure',
    risks: 'Regulatory, competitive, and macro risks apply; the data here is limited.',
    conclusion: 'Qualitatively solid; verify with live data before acting.',
    disclaimer: 'Educational research only. Not financial advice.',
    ...overrides,
  }
}

async function callResearch(body: unknown) {
  const { POST } = await import('@/app/api/research/route')
  const req = new NextRequest('http://localhost/api/research', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  const res = await POST(req)
  const json = await res.json()
  return { status: res.status, json }
}

const BASE_REQUEST = { ticker: 'AAPL', company_name: 'Apple Inc.', industry: 'Technology' }

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } })
  createMock.mockReset()
  insertMock.mockReset()
})

describe('POST /api/research — AI-response safety', () => {
  it('persists and returns a valid report with server-controlled empty news_summary', async () => {
    createMock.mockResolvedValue(aiText(validNarrative()))
    const { status, json } = await callResearch(BASE_REQUEST)
    expect(status).toBe(200)
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock.mock.calls[0][0]).toBe('research_reports')
    // News stays server-controlled and empty.
    expect(insertMock.mock.calls[0][1].news_summary).toBe('')
    expect(json.news_summary).toBe('')
    expect(json.error).toBeUndefined()
  })

  it('returns a generic 502 and does NOT persist when essential sections are missing', async () => {
    const { conclusion: _drop, risks: _drop2, ...partial } = validNarrative()
    createMock.mockResolvedValue(aiText(partial))
    const { status, json } = await callResearch(BASE_REQUEST)
    expect(status).toBe(502)
    expect(json.error).toBe('ai_response_invalid')
    // No internal validation detail leaks to the client.
    expect(json.details).toBeUndefined()
    expect(json.errors).toBeUndefined()
    expect(json.overview).toBeUndefined()
    expect(Object.keys(json).sort()).toEqual(['error', 'message'])
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 502 and does NOT persist when the model supplies a score field', async () => {
    createMock.mockResolvedValue(aiText(validNarrative({ score: 88 })))
    const { status, json } = await callResearch(BASE_REQUEST)
    expect(status).toBe(502)
    expect(json.error).toBe('ai_response_invalid')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 502 and does NOT persist when the model supplies a news field', async () => {
    createMock.mockResolvedValue(aiText(validNarrative({ news_summary: 'Company announced a buyback today.' })))
    const { status } = await callResearch(BASE_REQUEST)
    expect(status).toBe(502)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 502 and does NOT persist on malformed JSON', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'not json at all' }] })
    const { status, json } = await callResearch(BASE_REQUEST)
    expect(status).toBe(502)
    expect(json.error).toBe('ai_response_invalid')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns 502 and does NOT persist when the response has only irrelevant fields', async () => {
    createMock.mockResolvedValue(aiText({ foo: 'bar', hello: 'world' }))
    const { status } = await callResearch(BASE_REQUEST)
    expect(status).toBe(502)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('does not transform invalid output into an apparently-successful blank report', async () => {
    createMock.mockResolvedValue(aiText({ overview: '' }))
    const { status, json } = await callResearch(BASE_REQUEST)
    expect(status).toBe(502)
    // No blank report object is returned.
    expect(json.overview).toBeUndefined()
    expect(json.conclusion).toBeUndefined()
    expect(insertMock).not.toHaveBeenCalled()
  })
})

import Anthropic from '@anthropic-ai/sdk'
import { resolveModelId } from '@/lib/ai/model'

// Server-side only: the API key and client must never be imported from
// client components (next.config keeps @anthropic-ai/sdk external to the
// server bundle).
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const MODEL_ID = resolveModelId(process.env.ANTHROPIC_MODEL)

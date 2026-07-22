import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL_ID } from '@/lib/ai/client'
import { buildChatPrompt } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import { MAX_BODY_BYTES, validateChatRequest } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawText = await request.text()
    if (rawText.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
    }
    let raw: unknown
    try {
      raw = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const parsed = validateChatRequest(raw)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { message, session_id, context_ticker, context_report, history } = parsed.value

    const systemPrompt = buildChatPrompt(context_ticker ?? null, context_report ?? null)

    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...history,
      { role: 'user', content: message },
    ]

    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const content = response.content[0]
    if (!content || content.type !== 'text') {
      return NextResponse.json(
        { error: 'ai_response_invalid', message: 'The AI returned no text content.' },
        { status: 502 }
      )
    }

    const assistantContent = content.text

    // Best-effort persistence; session_id is a validated UUID (or was
    // regenerated server-side by the validator).
    await supabase.from('chat_messages').insert([
      {
        user_id: user.id,
        session_id,
        role: 'user',
        content: message,
        context_ticker: context_ticker ?? null,
      },
      {
        user_id: user.id,
        session_id,
        role: 'assistant',
        content: assistantContent,
        context_ticker: context_ticker ?? null,
      },
    ])

    return NextResponse.json({ content: assistantContent })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

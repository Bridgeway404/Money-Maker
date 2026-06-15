import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL_ID } from '@/lib/ai/client'
import { buildChatPrompt } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import type { ChatRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ChatRequest = await request.json()
    const { message, session_id, context_ticker, context_report, history } = body

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    const systemPrompt = buildChatPrompt(context_ticker ?? null, context_report ?? null)

    // Build messages array from history + current message
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history ?? []).slice(-10),
      { role: 'user', content: message },
    ]

    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const assistantContent = content.text

    // Save messages to DB (best effort)
    const sessionUUID = session_id.includes('-') ? session_id : crypto.randomUUID()
    await supabase.from('chat_messages').insert([
      {
        user_id: user.id,
        session_id: sessionUUID,
        role: 'user',
        content: message,
        context_ticker: context_ticker ?? null,
      },
      {
        user_id: user.id,
        session_id: sessionUUID,
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

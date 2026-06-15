'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Send, MessageCircle, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  contextTicker?: string
  contextReport?: string
  initialMessage?: string
}

export default function ChatPanel({ contextTicker, contextReport, initialMessage }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      setMessages([{ role: 'assistant', content: initialMessage }])
    }
  }, [initialMessage, messages.length])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId,
          context_ticker: contextTicker,
          context_report: contextReport?.slice(0, 3000),
          history: messages.slice(-10),
        }),
      })

      if (!response.ok) throw new Error('Chat request failed')

      const data = await response.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'I encountered an error. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  return (
    <>
      {/* Toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center transition-all duration-150 z-40"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col z-40">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Ask Follow-Up</p>
              {contextTicker && (
                <p className="text-xs text-zinc-400">Context: {contextTicker}</p>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">
                  Ask any follow-up questions about{' '}
                  {contextTicker ? `${contextTicker} or` : ''} LEAPS strategy.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2">
                  <LoadingSpinner size="sm" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question... (Enter to send)"
                rows={2}
                className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || loading}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

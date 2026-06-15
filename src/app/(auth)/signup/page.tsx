'use client'

export const dynamic = 'force-dynamic'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      // Redirect to onboarding
      router.push('/onboarding')
      router.refresh()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-zinc-100">LEAPS AI</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">Create your account</h1>
          <p className="text-zinc-400 text-sm mt-1">Start your LEAPS research today</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Investor"
              autoComplete="name"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[34px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-400/10 border border-rose-400/20">
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} fullWidth size="lg">
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-4 px-4">
          By signing up, you acknowledge this is an educational research tool and not financial advice.
        </p>

        <p className="text-center text-sm text-zinc-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  BookOpen,
  TrendingUp,
  Star,
  Briefcase,
  Settings,
  LogOut,
  ChevronRight,
  Activity,
} from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/screener', label: 'Screener', icon: Search },
  { href: '/research', label: 'Research', icon: BookOpen },
  { href: '/leaps', label: 'LEAPS Ideas', icon: TrendingUp },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-64 shrink-0 bg-zinc-950 border-r border-zinc-800 min-h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-zinc-100 tracking-tight">LEAPS AI</span>
        </Link>
        <p className="text-xs text-zinc-500 mt-1 ml-10">Research Assistant</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
              )}
            >
              <Icon
                className={clsx(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                )}
              />
              {label}
              {isActive && (
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-emerald-500" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-zinc-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-400/5 transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

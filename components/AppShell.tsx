'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  CalendarDays, LayoutDashboard, Users, ListTodo, WalletCards, 
  Settings, LogOut, UserCheck, Menu, X, ChevronRight, Sparkles 
} from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'

// Primary bottom navigation items (4 core tabs)
const primaryNav = [
  { href: '/', label: 'Home', Icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { href: '/attendance', label: 'Attendance', Icon: UserCheck },
  { href: '/students', label: 'Students', Icon: Users },
]

// Secondary items accessible in sidebar (desktop) and in "More" bottom sheet (mobile)
const moreNav = [
  { href: '/tasks', label: 'Tasks', Icon: ListTodo, desc: 'Lesson plans & reminders' },
  { href: '/payments', label: 'Payments', Icon: WalletCards, desc: 'Fee tracking & history' },
  { href: '/settings', label: 'Settings', Icon: Settings, desc: 'Timing & preferences' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  async function logout() {
    const s = getSupabaseBrowser()
    if (s) await s.auth.signOut()
    localStorage.removeItem('tg_demo_auth')
    router.push('/login')
  }

  const isMoreActive = moreNav.some(item => path === item.href)

  return (
    <div className="app-shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <span>TutorGrid</span>
        </div>
        <nav className="nav">
          {primaryNav.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={path === href ? 'active' : ''}>
              <Icon size={19} />
              <span>{label === 'Home' ? 'Dashboard' : label}</span>
            </Link>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 12px' }} />
          {moreNav.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={path === href ? 'active' : ''}>
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 12px' }} />
          <a href="#" onClick={e => { e.preventDefault(); logout() }}>
            <LogOut size={19} />
            <span>Logout</span>
          </a>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main">{children}</main>

      {/* Mobile Modern Bottom Navigation Bar */}
      <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
        {primaryNav.map(({ href, label, Icon }) => {
          const isActive = path === href
          return (
            <Link 
              key={href} 
              href={href} 
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMoreOpen(false)}
            >
              <div className="mobile-nav-icon-wrap">
                <Icon size={20} />
              </div>
              <span className="mobile-nav-label">{label}</span>
            </Link>
          )
        })}

        {/* 5th Tab: "More" Menu Toggle */}
        <button
          type="button"
          className={`mobile-nav-item ${isMoreActive || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(!moreOpen)}
          aria-expanded={moreOpen}
        >
          <div className="mobile-nav-icon-wrap">
            {moreOpen ? <X size={20} /> : <Menu size={20} />}
          </div>
          <span className="mobile-nav-label">More</span>
        </button>
      </nav>

      {/* Mobile "More" Drawer / Slide-Up Sheet */}
      {moreOpen && (
        <div 
          className="mobile-sheet-backdrop"
          onClick={() => setMoreOpen(false)}
        >
          <div 
            className="mobile-sheet-panel"
            onClick={e => e.stopPropagation()}
          >
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 13 }}>T</div>
                <b style={{ fontSize: 16 }}>TutorGrid Menu</b>
              </div>
              <button 
                type="button" 
                onClick={() => setMoreOpen(false)}
                style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mobile-sheet-items">
              {moreNav.map(({ href, label, Icon, desc }) => {
                const isActive = path === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`mobile-sheet-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMoreOpen(false)}
                  >
                    <div className="mobile-sheet-icon">
                      <Icon size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{desc}</div>
                    </div>
                    <ChevronRight size={16} color="#94a3b8" />
                  </Link>
                )
              })}

              <button
                type="button"
                className="mobile-sheet-link logout"
                onClick={() => { setMoreOpen(false); logout() }}
              >
                <div className="mobile-sheet-icon danger">
                  <LogOut size={20} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626' }}>Logout</div>
                  <div style={{ fontSize: 11, color: '#ef4444' }}>Sign out of TutorGrid</div>
                </div>
                <ChevronRight size={16} color="#ef4444" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

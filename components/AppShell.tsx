'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, LayoutDashboard, Users, ListTodo, WalletCards, Settings, LogOut } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase'

const items=[['/','Dashboard',LayoutDashboard],['/calendar','Calendar',CalendarDays],['/students','Students',Users],['/tasks','Tasks',ListTodo],['/payments','Payments',WalletCards],['/settings','Settings',Settings]] as const
export default function AppShell({children}:{children:React.ReactNode}){
 const path=usePathname(); const router=useRouter()
 async function logout(){const s=getSupabaseBrowser(); if(s) await s.auth.signOut(); localStorage.removeItem('tg_demo_auth'); router.push('/login')}
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">T</div><span>TutorGrid</span></div><nav className="nav">{items.map(([href,label,Icon])=><Link key={href} href={href} className={path===href?'active':''}><Icon size={19}/><span>{label}</span></Link>)}<a href="#" onClick={e=>{e.preventDefault();logout()}}><LogOut size={19}/><span>Logout</span></a></nav></aside><main className="main">{children}</main></div>
}

'use client'
import { useEffect,useState } from 'react'
import { usePathname,useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'
export default function AuthGuard({children}:{children:React.ReactNode}){
 const [ready,setReady]=useState(false); const router=useRouter(); const path=usePathname()
 useEffect(()=>{(async()=>{if(path==='/login'){setReady(true);return} const s=getSupabaseBrowser(); if(!s){if(localStorage.getItem('tg_demo_auth')==='1'){setReady(true)}else router.replace('/login'); return} const {data}=await s.auth.getSession(); if(!data.session) router.replace('/login'); else setReady(true)})()},[path,router])
 if(!ready) return <div className="empty">Loading TutorGrid…</div>
 return <>{children}</>
}

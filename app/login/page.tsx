'use client'
import { FormEvent,useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'

export default function LoginPage(){
 const [username,setUsername]=useState('admin'),[password,setPassword]=useState(''),[error,setError]=useState(''); const router=useRouter()
 async function submit(e:FormEvent){e.preventDefault();setError(''); const expected=process.env.NEXT_PUBLIC_ADMIN_USERNAME||'admin';if(username!==expected){setError('Invalid username');return} const supabase=getSupabaseBrowser(); if(!supabase){if(password==='tanviraz88'){localStorage.setItem('tg_demo_auth','1');router.push('/')}else setError('Invalid password');return} const email=process.env.NEXT_PUBLIC_ADMIN_EMAIL||'admin@tutorgrid.local'; const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);else router.push('/')}
 return <div className="login-page"><div className="login-card"><div className="brand" style={{color:'#111827',padding:0,marginBottom:20}}><div className="brand-mark">T</div><span>TutorGrid</span></div><h1 style={{margin:'0 0 6px'}}>Welcome back</h1><p className="sub">Sign in to manage students, classes, tasks and payments.</p><form onSubmit={submit} className="list" style={{marginTop:20}}><div className="field"><label>Username</label><input className="input" value={username} onChange={e=>setUsername(e.target.value)}/></div><div className="field"><label>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoFocus/></div>{error&&<div className="danger-text">{error}</div>}<button className="btn btn-primary" type="submit">Sign in</button></form><div className="pwa-note">When Supabase is configured, the password is stored securely by Supabase Auth, not in the frontend.</div></div></div>
}

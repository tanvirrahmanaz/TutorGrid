'use client'
import { FormEvent,useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'

export default function LoginPage(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''); const router=useRouter()
 async function submit(e:FormEvent){e.preventDefault();setError('');const supabase=getSupabaseBrowser();if(!supabase){const adminEmail=process.env.NEXT_PUBLIC_ADMIN_EMAIL;const demoPassword=process.env.NEXT_PUBLIC_DEMO_PASSWORD;if(adminEmail&&demoPassword&&email===adminEmail&&password===demoPassword){localStorage.setItem('tg_demo_auth','1');router.push('/')}else setError('Demo login is disabled. Configure Supabase Auth or set local demo credentials.');return}const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError('Invalid email or password');else router.push('/')}
 return <div className="login-page"><div className="login-card"><div className="brand" style={{color:'#111827',padding:0,marginBottom:20}}><div className="brand-mark">T</div><span>TutorGrid</span></div><h1 style={{margin:'0 0 6px'}}>Welcome back</h1><p className="sub">Sign in to manage students, classes, tasks and payments.</p><form onSubmit={submit} className="list" style={{marginTop:20}}><div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tanvirrahmanaz@gmail.com" autoFocus/></div><div className="field"><label>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></div>{error&&<div className="danger-text">{error}</div>}<button className="btn btn-primary" type="submit">Sign in</button></form></div></div>
}

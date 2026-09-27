'use client'
import {useState} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import {useData} from '@/components/DataProvider'
import {getSupabaseBrowser} from '@/lib/supabase'

function SettingsPage(){
  const {settings, saveSettings} = useData()
  const [msg, setMsg] = useState('')
  const [pw, setPw] = useState('')

  async function save(fd: FormData) {
    await saveSettings({
      day_start: String(fd.get('day_start')),
      day_end: String(fd.get('day_end')),
      interval_minutes: Number(fd.get('interval_minutes')),
      default_duration_minutes: Number(fd.get('default_duration_minutes'))
    })
    setMsg('Settings saved.')
  }

  async function changePassword() {
    const s = getSupabaseBrowser()
    if (!s) {
      setMsg('Password change requires Supabase configuration.')
      return
    }
    const {error} = await s.auth.updateUser({password: pw})
    setMsg(error ? error.message : 'Password changed successfully.')
    setPw('')
  }

  return <>
    <Topbar title="Settings" subtitle="Calendar defaults and account"/>
    <div className="grid grid-2">
      <div className="card">
        <h3 className="section-title">Calendar settings</h3>
        <form action={save} className="form-grid">
          <div className="field"><label>Day starts</label><input className="input" type="time" name="day_start" defaultValue={settings.day_start}/></div>
          <div className="field"><label>Day ends</label><input className="input" type="time" name="day_end" defaultValue={settings.day_end}/></div>
          <div className="field"><label>Time interval</label><select className="select" name="interval_minutes" defaultValue={settings.interval_minutes}>{[15,30,45,60].map(x => <option key={x} value={x}>{x} minutes</option>)}</select></div>
          <div className="field"><label>Default class duration</label><input className="input" name="default_duration_minutes" type="number" min="15" step="15" defaultValue={settings.default_duration_minutes}/></div>
          <div style={{gridColumn:'1/-1'}}><button className="btn btn-primary">Save settings</button></div>
        </form>
      </div>
      <div className="card">
        <h3 className="section-title">Account & app</h3>
        <div className="field"><label>New password</label><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter new password"/></div>
        <button className="btn btn-soft" style={{marginTop:10}} onClick={changePassword}>Change password</button>
        <p className="pwa-note">Use your browser's Install app / Add to Home screen option to install TutorGrid as a PWA.</p>
      </div>
    </div>
    {msg && <div className="card" style={{marginTop:16}}>{msg}</div>}
  </>
}

export default function Page(){return <ProtectedLayout><SettingsPage/></ProtectedLayout>}

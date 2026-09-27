'use client'
import {useState} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import {useData} from '@/components/DataProvider'
import {DAYS, prettyTime, currency} from '@/lib/utils'
import {Plus, Search, Archive, FileText, Calendar, AlertTriangle, CheckCircle2, UserX} from 'lucide-react'
import Link from 'next/link'

function StudentsContent(){
  const {students, schedules, saveStudent, archiveStudent} = useData()
  const [q, setQ] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'scheduled' | 'unscheduled'>('all')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const activeStudents = students.filter(s => !s.archived)

  const shown = activeStudents
    .filter(s => (s.name + ' ' + s.subject).toLowerCase().includes(q.toLowerCase()))
    .filter(s => {
      const hasSched = schedules.some(sc => sc.student_id === s.id && sc.active !== false)
      if (filterType === 'scheduled') return hasSched
      if (filterType === 'unscheduled') return !hasSched
      return true
    })

  const unscheduledCount = activeStudents.filter(s => !schedules.some(sc => sc.student_id === s.id && sc.active !== false)).length

  async function submit(fd: FormData){
    await saveStudent({
      id: editing?.id,
      name: String(fd.get('name')),
      subject: String(fd.get('subject')),
      monthly_fee: Number(fd.get('monthly_fee') || 0),
      notes: String(fd.get('notes') || ''),
      color: String(fd.get('color') || '#4f46e5')
    })
    setModal(false)
    setEditing(null)
  }

  return (
    <>
      <Topbar
        title="Students"
        subtitle="Profiles, weekly schedule status, monthly fees & notes"
        actions={
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModal(true) }}>
            <Plus size={16}/> Add student
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div className="toolbar" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <div style={{position:'relative', maxWidth:320, width:'100%'}}>
          <Search size={16} style={{position:'absolute', left:12, top:12, color:'#98a2b3'}}/>
          <input
            className="input"
            style={{paddingLeft:36}}
            placeholder="Search student or subject…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          <button
            type="button"
            className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{fontSize:12, padding:'6px 12px'}}
            onClick={() => setFilterType('all')}
          >
            All ({activeStudents.length})
          </button>
          <button
            type="button"
            className={`btn ${filterType === 'scheduled' ? 'btn-primary' : 'btn-ghost'}`}
            style={{fontSize:12, padding:'6px 12px'}}
            onClick={() => setFilterType('scheduled')}
          >
            ✓ Scheduled ({activeStudents.length - unscheduledCount})
          </button>
          <button
            type="button"
            className={`btn ${filterType === 'unscheduled' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              fontSize:12, padding:'6px 12px',
              background: filterType === 'unscheduled' ? '#ea580c' : '#fff7ed',
              color: filterType === 'unscheduled' ? '#fff' : '#c2410c',
              border: '1px solid #ea580c'
            }}
            onClick={() => setFilterType('unscheduled')}
          >
            ⚠️ Unscheduled ({unscheduledCount})
          </button>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="student-grid">
        {shown.map(s => {
          const studentScheds = schedules
            .filter(sc => sc.student_id === s.id && sc.active !== false)
            .sort((a,b) => a.day_of_week - b.day_of_week)
          const isUnscheduled = studentScheds.length === 0

          return (
            <div 
              className="student-card" 
              key={s.id}
              style={{
                border: isUnscheduled ? '1px solid #fed7aa' : '1px solid var(--line)',
                background: isUnscheduled ? '#fffbf7' : '#fff'
              }}
            >
              <div className="student-head">
                <div className="avatar" style={{background: s.color || '#4f46e5'}}>
                  {s.name.slice(0,1).toUpperCase()}
                </div>
                <div>
                  <b>{s.name}</b>
                  <div className="sub">{s.subject || 'No subject set'} · {currency(s.monthly_fee || 0)}</div>
                </div>
              </div>

              {/* Schedule Status Badge */}
              <div style={{marginTop:12}}>
                {isUnscheduled ? (
                  <div style={{
                    display:'inline-flex', alignItems:'center', gap:5,
                    background:'#fff7ed', color:'#c2410c', border:'1px solid #fdba74',
                    padding:'4px 10px', borderRadius:8, fontSize:12, fontWeight:700
                  }}>
                    <AlertTriangle size={13}/> No schedule set (রুটিন বাকি)
                  </div>
                ) : (
                  <div style={{
                    display:'inline-flex', alignItems:'center', gap:5,
                    background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0',
                    padding:'4px 10px', borderRadius:8, fontSize:12, fontWeight:600
                  }}>
                    <Calendar size={13}/> 
                    <span>
                      {studentScheds.map(sc => `${DAYS[sc.day_of_week].slice(0,3)} (${prettyTime(sc.start_time)})`).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="sub" style={{marginTop:10, fontSize:13}}>
                {s.notes || 'No notes yet.'}
              </div>

              <div className="toolbar" style={{margin:'14px 0 0', display:'flex', gap:6, flexWrap:'wrap'}}>
                <Link className="btn btn-soft" href={`/students/${s.id}`}>Open</Link>
                <button className="btn btn-soft" onClick={() => { setEditing(s); setModal(true) }}>Edit</button>
                {isUnscheduled ? (
                  <Link 
                    className="btn" 
                    href="/calendar"
                    style={{background:'#ea580c', color:'#fff', fontSize:12, padding:'6px 12px'}}
                  >
                    ⚡ Set Schedule
                  </Link>
                ) : (
                  <Link 
                    className="btn btn-ghost" 
                    href="/calendar"
                    style={{fontSize:12, padding:'6px 10px'}}
                  >
                    Calendar
                  </Link>
                )}
                <button className="btn btn-ghost" onClick={() => archiveStudent(s.id)} title="Archive">
                  <Archive size={14}/>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Student Modal */}
      {modal && (
        <Modal title={editing ? 'Edit student' : 'Add student'} onClose={() => setModal(false)}>
          <form action={submit} className="form-grid">
            <div className="field">
              <label>Student name</label>
              <input className="input" name="name" defaultValue={editing?.name || ''} required/>
            </div>
            <div className="field">
              <label>Subject</label>
              <input className="input" name="subject" defaultValue={editing?.subject || ''}/>
            </div>
            <div className="field">
              <label>Monthly fee (BDT)</label>
              <input className="input" name="monthly_fee" type="number" defaultValue={editing?.monthly_fee || 0}/>
            </div>
            <div className="field">
              <label>Color</label>
              <input className="input" name="color" type="color" defaultValue={editing?.color || '#4f46e5'}/>
            </div>
            <div className="field" style={{gridColumn:'1/-1'}}>
              <label>Notes</label>
              <textarea className="textarea" name="notes" rows={4} defaultValue={editing?.notes || ''}/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <button className="btn btn-primary" type="submit">Save student</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

export default function Page(){
  return (
    <ProtectedLayout>
      <StudentsContent/>
    </ProtectedLayout>
  )
}

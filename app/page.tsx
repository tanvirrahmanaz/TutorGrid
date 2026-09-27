'use client'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import { useData } from '@/components/DataProvider'
import { currency, DAYS, prettyTime } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, UserCheck } from 'lucide-react'

// Convert JS getDay() (0=Sun..6=Sat) to TutorGrid DAYS index (0=Sat, 1=Sun..6=Fri)
function getDayIndex(d: Date) {
  const js = d.getDay()
  return js === 6 ? 0 : js + 1
}

function Dashboard(){
  const {students, schedules, tasks, payments, exceptions, saveException} = useData()
  const active = students.filter(s => !s.archived)
  
  const todayDate = new Date()
  const todayDayIdx = getDayIndex(todayDate)
  const todayKey = format(todayDate, 'yyyy-MM-dd')

  const todays = schedules
    .filter(s => s.day_of_week === todayDayIdx && s.active !== false)
    .sort((a,b) => a.start_time.localeCompare(b.start_time))

  const pending = tasks.filter(t => t.status !== 'done')
  const month = format(todayDate, 'yyyy-MM')
  const received = payments.filter(p => p.month_key === month).reduce((a,p) => a + Number(p.amount), 0)
  const totalMonthlyTarget = active.reduce((a,s) => a + Number(s.monthly_fee || 0), 0)
  const due = Math.max(0, totalMonthlyTarget - received)

  function getStatus(student_id: string, startTime: string) {
    const ex = exceptions.find(e => e.student_id === student_id && e.class_date === todayKey && e.start_time.slice(0,5) === startTime.slice(0,5))
    return ex ? ex.status : 'pending'
  }

  async function handleMark(s: typeof todays[0], status: 'completed' | 'absent' | 'cancelled' | 'missed') {
    await saveException({
      schedule_id: s.id,
      student_id: s.student_id,
      class_date: todayKey,
      start_time: s.start_time.slice(0,5),
      duration_minutes: s.duration_minutes,
      status
    })
  }

  return (
    <ProtectedLayout>
      <Topbar
        title="Dashboard"
        subtitle={`${format(todayDate, 'EEEE, d MMMM yyyy')} · Tutoring command center`}
        actions={
          <Link className="btn btn-primary" href="/attendance" style={{display:'flex', alignItems:'center', gap:6}}>
            <UserCheck size={16}/> Go to Attendance
          </Link>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-4">
        <div className="card">
          <div className="stat-label">Active students</div>
          <div className="stat-value">{active.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Today's classes</div>
          <div className="stat-value">{todays.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Pending tasks</div>
          <div className="stat-value">{pending.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Monthly due</div>
          <div className="stat-value" style={{color: due > 0 ? '#dc2626' : '#059669'}}>
            {currency(due)}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{marginTop:16}}>
        {/* Today's Schedule Card */}
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
            <h3 className="section-title" style={{margin:0}}>Today's schedule</h3>
            <span className="badge" style={{background:'#e0e7ff', color:'#4338ca', fontWeight:700}}>
              {DAYS[todayDayIdx]}
            </span>
          </div>
          <div className="list">
            {todays.length ? (
              todays.map(s => {
                const student = students.find(x => x.id === s.student_id)
                return (
                  <div className="list-item" key={s.id}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{width:32, height:32, borderRadius:8, background:student?.color||'#4f46e5', color:'#fff', display:'grid', placeItems:'center', fontWeight:800, fontSize:13}}>
                        {student?.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <b>{student?.name || 'Student'}</b>
                        <div className="sub">{prettyTime(s.start_time)} · {s.duration_minutes} min</div>
                      </div>
                    </div>
                    <span className="badge">{student?.subject || 'Tutoring'}</span>
                  </div>
                )
              })
            ) : (
              <div className="empty">No class scheduled today.</div>
            )}
          </div>
        </div>

        {/* Tasks Card */}
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
            <h3 className="section-title" style={{margin:0}}>Pending Tasks</h3>
            <Link href="/tasks" className="sub" style={{color:'#4f46e5', textDecoration:'none', fontWeight:600}}>
              View all →
            </Link>
          </div>
          <div className="list">
            {pending.length ? (
              pending.slice(0,6).map(t => (
                <div className="list-item" key={t.id}>
                  <div>
                    <b>{t.title}</b>
                    <div className="sub">{t.priority} priority {t.due_at ? `· due ${t.due_at.slice(0,10)}` : ''}</div>
                  </div>
                  <span className={'badge ' + (t.priority === 'high' ? 'red' : '')}>
                    {t.status.replace('_',' ')}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty">All caught up! No pending tasks.</div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Quick Roll-Call */}
      <div className="card" style={{marginTop:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8}}>
          <div>
            <h3 className="section-title" style={{margin:0}}>Today's Attendance Check</h3>
            <div className="sub">Mark attendance for today's classes</div>
          </div>
          <Link href="/attendance" className="btn btn-soft" style={{display:'flex', alignItems:'center', gap:6, fontSize:13}}>
            Full Attendance Sheet <ArrowRight size={14}/>
          </Link>
        </div>

        {todays.length ? (
          <div className="list">
            {todays.map(s => {
              const student = students.find(x => x.id === s.student_id)
              const status = getStatus(s.student_id, s.start_time)
              const isCompleted = status === 'completed'
              const isAbsent = status === 'absent'
              const isCancelled = ['cancelled', 'off', 'missed'].includes(status)

              return (
                <div 
                  className="list-item" 
                  key={s.id}
                  style={{
                    background: isCompleted ? '#f0fdf4' : isAbsent ? '#fef2f2' : isCancelled ? '#fffbeb' : '#fff',
                    border: isCompleted ? '1px solid #bbf7d0' : isAbsent ? '1px solid #fecaca' : isCancelled ? '1px solid #fde68a' : '1px solid #e5e7eb',
                    flexWrap:'wrap',
                    gap:10
                  }}
                >
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div style={{width:36, height:36, borderRadius:10, background:student?.color||'#4f46e5', color:'#fff', display:'grid', placeItems:'center', fontWeight:800, fontSize:14}}>
                      {student?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <b>{student?.name || 'Student'}</b>
                      <div className="sub">{prettyTime(s.start_time)} ({s.duration_minutes}m) · {student?.subject || 'Tutoring'}</div>
                    </div>
                  </div>

                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleMark(s, 'completed')}
                      style={{
                        padding:'6px 12px',
                        fontSize:12,
                        background: isCompleted ? '#059669' : '#ecfdf5',
                        color: isCompleted ? '#fff' : '#047857',
                        border: isCompleted ? '1px solid #059669' : '1px solid #a7f3d0'
                      }}
                    >
                      <CheckCircle2 size={13} style={{display:'inline', marginRight:4, verticalAlign:-2}}/>
                      Completed
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleMark(s, 'absent')}
                      style={{
                        padding:'6px 12px',
                        fontSize:12,
                        background: isAbsent ? '#dc2626' : '#fff1f2',
                        color: isAbsent ? '#fff' : '#b91c1c',
                        border: isAbsent ? '1px solid #dc2626' : '1px solid #fecaca'
                      }}
                    >
                      <XCircle size={13} style={{display:'inline', marginRight:4, verticalAlign:-2}}/>
                      Absent
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleMark(s, 'cancelled')}
                      style={{
                        padding:'6px 10px',
                        fontSize:12,
                        background: isCancelled ? '#d97706' : '#fffbeb',
                        color: isCancelled ? '#fff' : '#b45309',
                        border: isCancelled ? '1px solid #d97706' : '1px solid #fde68a'
                      }}
                    >
                      <AlertTriangle size={13} style={{display:'inline', marginRight:4, verticalAlign:-2}}/>
                      Cancelled
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty">No classes scheduled for today.</div>
        )}
      </div>
    </ProtectedLayout>
  )
}

export default Dashboard

'use client'
import {useState, useMemo} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import {useData} from '@/components/DataProvider'
import {DAYS, prettyTime} from '@/lib/utils'
import {format, addDays, subDays, parseISO, isToday} from 'date-fns'
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Calendar as CalIcon,
  ChevronLeft, ChevronRight, UserCheck, Plus, Trash2, Edit3, Filter
} from 'lucide-react'

// Convert JS getDay() (0=Sun..6=Sat) to TutorGrid DAYS index (0=Sat, 1=Sun..6=Fri)
function getDayIndex(d: Date) {
  const js = d.getDay()
  return js === 6 ? 0 : js + 1
}

function AttendanceContent() {
  const {students, schedules, exceptions, saveException, deleteException} = useData()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [studentFilter, setStudentFilter] = useState<string>('all')
  const [extraModal, setExtraModal] = useState(false)
  const [noteModal, setNoteModal] = useState<{ student_id: string; class_date: string; start_time: string; note: string } | null>(null)
  const [noteText, setNoteText] = useState('')

  const activeStudents = students.filter(s => !s.archived)
  const dateKey = format(selectedDate, 'yyyy-MM-dd')
  const dayIdx = getDayIndex(selectedDate)
  const dayName = DAYS[dayIdx]

  // Scheduled classes for selected date
  const scheduledForDate = useMemo(() => {
    return schedules
      .filter(s => Number(s.day_of_week) === Number(dayIdx) && s.active !== false)
      .filter(s => studentFilter === 'all' || s.student_id === studentFilter)
      .sort((a,b) => a.start_time.localeCompare(b.start_time))
  }, [schedules, dayIdx, studentFilter])

  // All exceptions/records for this date (including extra/rescheduled classes)
  const exceptionsForDate = useMemo(() => {
    return exceptions.filter(e => e.class_date === dateKey)
  }, [exceptions, dateKey])

  // Combined daily class list
  const dailyClasses = useMemo(() => {
    const list: any[] = []
    
    // Regular scheduled classes
    scheduledForDate.forEach(sch => {
      const student = students.find(s => s.id === sch.student_id)
      const ex = exceptionsForDate.find(e => e.student_id === sch.student_id && e.start_time.slice(0,5) === sch.start_time.slice(0,5))
      list.push({
        id: sch.id,
        schedule_id: sch.id,
        student_id: sch.student_id,
        student,
        start_time: sch.start_time.slice(0,5),
        duration_minutes: sch.duration_minutes || 60,
        status: ex ? ex.status : 'pending',
        exception_id: ex?.id,
        note: ex?.note || '',
        is_extra: false
      })
    })

    // Any ad-hoc extra/rescheduled classes for this date not in regular schedule
    exceptionsForDate.forEach(ex => {
      const alreadyInList = list.some(item => item.student_id === ex.student_id && item.start_time === ex.start_time.slice(0,5))
      if (!alreadyInList) {
        const student = students.find(s => s.id === ex.student_id)
        if (studentFilter === 'all' || ex.student_id === studentFilter) {
          list.push({
            id: ex.id,
            schedule_id: ex.schedule_id || null,
            student_id: ex.student_id,
            student,
            start_time: ex.start_time.slice(0,5),
            duration_minutes: ex.duration_minutes || 60,
            status: ex.status,
            exception_id: ex.id,
            note: ex.note || '',
            is_extra: true
          })
        }
      }
    })

    return list.sort((a,b) => a.start_time.localeCompare(b.start_time))
  }, [scheduledForDate, exceptionsForDate, students, studentFilter])

  // Monthly stats
  const currentMonthKey = format(selectedDate, 'yyyy-MM')
  const monthlyExceptions = exceptions.filter(e => e.class_date.startsWith(currentMonthKey))
  const monthlyCompleted = monthlyExceptions.filter(e => e.status === 'completed').length
  const monthlyAbsent = monthlyExceptions.filter(e => e.status === 'absent').length
  const monthlyCancelled = monthlyExceptions.filter(e => ['cancelled', 'off', 'missed'].includes(e.status)).length
  const totalMarked = monthlyCompleted + monthlyAbsent + monthlyCancelled
  const attendanceRate = totalMarked > 0 ? Math.round((monthlyCompleted / (monthlyCompleted + monthlyAbsent)) * 100) || 100 : 100

  async function markStatus(cls: typeof dailyClasses[0], newStatus: 'completed' | 'absent' | 'cancelled' | 'missed' | 'pending') {
    if (newStatus === 'pending') {
      if (cls.exception_id) {
        await deleteException(cls.exception_id)
      }
      return
    }

    await saveException({
      schedule_id: cls.schedule_id || undefined,
      student_id: cls.student_id,
      class_date: dateKey,
      start_time: cls.start_time,
      duration_minutes: cls.duration_minutes,
      status: newStatus,
      note: cls.note || undefined
    })
  }

  async function saveNote() {
    if (!noteModal) return
    const cls = dailyClasses.find(c => c.student_id === noteModal.student_id && c.start_time === noteModal.start_time)
    const currentStatus = cls?.status === 'pending' ? 'completed' : (cls?.status || 'completed')
    
    await saveException({
      schedule_id: cls?.schedule_id || undefined,
      student_id: noteModal.student_id,
      class_date: noteModal.class_date,
      start_time: noteModal.start_time,
      duration_minutes: cls?.duration_minutes || 60,
      status: currentStatus,
      note: noteText
    })
    setNoteModal(null)
  }

  async function handleAddExtra(fd: FormData) {
    const student_id = String(fd.get('student_id'))
    const class_date = String(fd.get('class_date'))
    const start_time = String(fd.get('start_time'))
    const duration_minutes = Number(fd.get('duration_minutes') || 60)
    const status = String(fd.get('status')) as any
    const note = String(fd.get('note') || '')

    await saveException({
      student_id,
      class_date,
      start_time,
      duration_minutes,
      status,
      note
    })
    setExtraModal(false)
  }

  return (
    <>
      <Topbar
        title="Attendance & Roll-Call"
        subtitle={`Daily attendance tracking · ${format(selectedDate, 'EEEE, d MMMM yyyy')}`}
        actions={
          <button className="btn btn-primary" onClick={() => setExtraModal(true)}>
            <Plus size={16}/> Record Extra Class
          </button>
        }
      />

      {/* Summary Cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginBottom:24}}>
        <div style={{background:'linear-gradient(135deg,#059669,#10b981)', borderRadius:16, padding:'18px 16px', color:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, opacity:.9, fontSize:13, marginBottom:6}}>
            <CheckCircle2 size={16}/> Classes Taken ({format(selectedDate, 'MMMM')})
          </div>
          <div style={{fontSize:26, fontWeight:900}}>{monthlyCompleted}</div>
          <div style={{fontSize:12, opacity:.75, marginTop:4}}>Completed sessions</div>
        </div>

        <div style={{background:'linear-gradient(135deg,#dc2626,#ef4444)', borderRadius:16, padding:'18px 16px', color:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, opacity:.9, fontSize:13, marginBottom:6}}>
            <XCircle size={16}/> Student Absences
          </div>
          <div style={{fontSize:26, fontWeight:900}}>{monthlyAbsent}</div>
          <div style={{fontSize:12, opacity:.75, marginTop:4}}>Missed by student</div>
        </div>

        <div style={{background:'linear-gradient(135deg,#d97706,#f59e0b)', borderRadius:16, padding:'18px 16px', color:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, opacity:.9, fontSize:13, marginBottom:6}}>
            <AlertTriangle size={16}/> Cancelled / Off
          </div>
          <div style={{fontSize:26, fontWeight:900}}>{monthlyCancelled}</div>
          <div style={{fontSize:12, opacity:.75, marginTop:4}}>Rescheduled or skipped</div>
        </div>

        <div style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:16, padding:'18px 16px', color:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, opacity:.9, fontSize:13, marginBottom:6}}>
            <UserCheck size={16}/> Attendance Rate
          </div>
          <div style={{fontSize:26, fontWeight:900}}>{attendanceRate}%</div>
          <div style={{fontSize:12, opacity:.75, marginTop:4}}>Present vs Absent</div>
        </div>
      </div>

      {/* Date Navigator & Filters */}
      <div className="card" style={{padding:'14px 18px', marginBottom:20}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12}}>
          {/* Date controls */}
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
            <button className="btn btn-ghost" onClick={() => setSelectedDate(subDays(selectedDate, 1))} title="Previous day">
              <ChevronLeft size={16}/>
            </button>
            <input
              type="date"
              className="input"
              style={{padding:'6px 10px', width:'auto', fontWeight:700}}
              value={dateKey}
              onChange={e => e.target.value && setSelectedDate(parseISO(e.target.value))}
            />
            <button className="btn btn-ghost" onClick={() => setSelectedDate(addDays(selectedDate, 1))} title="Next day">
              <ChevronRight size={16}/>
            </button>
            {!isToday(selectedDate) && (
              <button className="btn btn-soft" onClick={() => setSelectedDate(new Date())} style={{fontSize:12, padding:'6px 12px'}}>
                Today
              </button>
            )}
            <span style={{fontWeight:800, fontSize:15, color:'#334155', marginLeft:6}}>
              {format(selectedDate, 'EEEE, d MMM yyyy')}
            </span>
          </div>

          {/* Student Filter */}
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <Filter size={15} style={{color:'#64748b'}}/>
            <select
              className="select"
              style={{padding:'6px 12px', minWidth:180}}
              value={studentFilter}
              onChange={e => setStudentFilter(e.target.value)}
            >
              <option value="all">All Students</option>
              {activeStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Daily Attendance Sheet */}
      <div className="card" style={{padding:0, overflow:'hidden', marginBottom:24}}>
        <div style={{padding:'16px 20px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <h3 style={{margin:0, fontSize:16, fontWeight:800, color:'#0f172a'}}>
              Today's Roll-Call ({dailyClasses.length} {dailyClasses.length === 1 ? 'class' : 'classes'})
            </h3>
            <span style={{fontSize:12, color:'#64748b'}}>
              Click Completed, Absent, or Cancelled to mark attendance immediately
            </span>
          </div>
          <span className="badge" style={{background:'#e0e7ff', color:'#4338ca', fontWeight:700}}>
            {dayName}
          </span>
        </div>

        {dailyClasses.length === 0 ? (
          <div className="empty" style={{padding:'40px 20px'}}>
            <CalIcon size={32} style={{margin:'0 auto 10px', color:'#cbd5e1', display:'block'}}/>
            <b>No classes scheduled for {format(selectedDate, 'EEEE, d MMMM')}.</b>
            <p style={{fontSize:13, color:'#94a3b8', marginTop:4}}>
              Use "Record Extra Class" if you took an unscheduled class today.
            </p>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column'}}>
            {dailyClasses.map((c, idx) => {
              const isCompleted = c.status === 'completed'
              const isAbsent = c.status === 'absent'
              const isCancelled = ['cancelled', 'off', 'missed'].includes(c.status)
              const isPending = c.status === 'pending'

              return (
                <div
                  key={`${c.student_id}-${c.start_time}-${idx}`}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'space-between',
                    padding:'16px 20px',
                    borderBottom: idx === dailyClasses.length - 1 ? 'none' : '1px solid #f1f5f9',
                    background: isCompleted ? '#f0fdf4' : isAbsent ? '#fef2f2' : isCancelled ? '#fffbeb' : '#fff',
                    transition:'background .2s',
                    flexWrap:'wrap',
                    gap:14
                  }}
                >
                  {/* Student & Time info */}
                  <div style={{display:'flex', alignItems:'center', gap:12}}>
                    <div style={{
                      width:44, height:44, borderRadius:12,
                      background: c.student?.color || '#4f46e5',
                      color:'#fff', display:'grid', placeItems:'center',
                      fontWeight:800, fontSize:16, flexShrink:0
                    }}>
                      {c.student?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <b style={{fontSize:15, color:'#0f172a'}}>{c.student?.name || 'Unknown Student'}</b>
                        {c.is_extra && <span className="badge" style={{background:'#fef3c7', color:'#92400e', fontSize:10}}>Extra Class</span>}
                      </div>
                      <div style={{fontSize:13, color:'#64748b', display:'flex', alignItems:'center', gap:6, marginTop:2}}>
                        <span>{c.student?.subject || 'Tutoring'}</span>
                        <span>•</span>
                        <Clock size={13}/>
                        <span>{prettyTime(c.start_time)} ({c.duration_minutes} min)</span>
                      </div>
                      {c.note && (
                        <div style={{fontSize:12, color:'#047857', marginTop:4, background:'rgba(5, 150, 105, 0.08)', padding:'2px 8px', borderRadius:6, display:'inline-block'}}>
                          📝 {c.note}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attendance Action Buttons */}
                  <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                    {/* Completed / Present Button */}
                    <button
                      type="button"
                      onClick={() => markStatus(c, 'completed')}
                      style={{
                        padding:'8px 14px',
                        borderRadius:10,
                        fontSize:13,
                        fontWeight:700,
                        cursor:'pointer',
                        display:'flex',
                        alignItems:'center',
                        gap:6,
                        transition:'all .15s',
                        border: isCompleted ? '2px solid #059669' : '1px solid #d1fae5',
                        background: isCompleted ? '#059669' : '#ecfdf5',
                        color: isCompleted ? '#fff' : '#047857',
                        boxShadow: isCompleted ? '0 4px 10px rgba(5, 150, 105, 0.25)' : 'none'
                      }}
                    >
                      <CheckCircle2 size={15}/> Completed
                    </button>

                    {/* Absent Button */}
                    <button
                      type="button"
                      onClick={() => markStatus(c, 'absent')}
                      style={{
                        padding:'8px 14px',
                        borderRadius:10,
                        fontSize:13,
                        fontWeight:700,
                        cursor:'pointer',
                        display:'flex',
                        alignItems:'center',
                        gap:6,
                        transition:'all .15s',
                        border: isAbsent ? '2px solid #dc2626' : '1px solid #fee2e2',
                        background: isAbsent ? '#dc2626' : '#fff1f2',
                        color: isAbsent ? '#fff' : '#b91c1c',
                        boxShadow: isAbsent ? '0 4px 10px rgba(220, 38, 38, 0.25)' : 'none'
                      }}
                    >
                      <XCircle size={15}/> Absent
                    </button>

                    {/* Cancelled Button */}
                    <button
                      type="button"
                      onClick={() => markStatus(c, 'cancelled')}
                      style={{
                        padding:'8px 12px',
                        borderRadius:10,
                        fontSize:13,
                        fontWeight:650,
                        cursor:'pointer',
                        display:'flex',
                        alignItems:'center',
                        gap:5,
                        transition:'all .15s',
                        border: isCancelled ? '2px solid #d97706' : '1px solid #fef3c7',
                        background: isCancelled ? '#d97706' : '#fffbeb',
                        color: isCancelled ? '#fff' : '#b45309'
                      }}
                    >
                      <AlertTriangle size={14}/> Cancelled
                    </button>

                    {/* Note / Lesson detail button */}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{padding:'8px 10px', fontSize:12, display:'flex', alignItems:'center', gap:4}}
                      onClick={() => {
                        setNoteText(c.note || '')
                        setNoteModal({
                          student_id: c.student_id,
                          class_date: dateKey,
                          start_time: c.start_time,
                          note: c.note || ''
                        })
                      }}
                      title="Add note / what taught"
                    >
                      <Edit3 size={13}/> Note
                    </button>

                    {/* Revert / Clear */}
                    {!isPending && (
                      <button
                        type="button"
                        onClick={() => markStatus(c, 'pending')}
                        style={{border:'none', background:'none', color:'#94a3b8', fontSize:11, cursor:'pointer', padding:'4px 6px'}}
                        title="Reset to pending"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Monthly Attendance Log Table */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'16px 20px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0, fontSize:15, fontWeight:800}}>
            Attendance History — {format(selectedDate, 'MMMM yyyy')}
          </h3>
          <span style={{fontSize:12, color:'#64748b'}}>
            {monthlyExceptions.length} records this month
          </span>
        </div>

        {monthlyExceptions.length === 0 ? (
          <div className="empty" style={{padding:30}}>
            No attendance records logged for {format(selectedDate, 'MMMM yyyy')} yet.
          </div>
        ) : (
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#fafbfc', borderBottom:'1px solid #e2e8f0'}}>
                <th style={th()}>Date</th>
                <th style={th()}>Student</th>
                <th style={th()}>Time</th>
                <th style={th()}>Status</th>
                <th style={th()}>Note</th>
                <th style={th()}>Action</th>
              </tr>
            </thead>
            <tbody>
              {monthlyExceptions
                .sort((a,b) => b.class_date.localeCompare(a.class_date))
                .slice(0, 25)
                .map((ex, i) => {
                  const s = students.find(x => x.id === ex.student_id)
                  return (
                    <tr key={ex.id || i} style={{borderBottom:'1px solid #f1f5f9', background: i%2===0?'#fff':'#fafbfc'}}>
                      <td style={td()}><b>{format(parseISO(ex.class_date), 'd MMM (EEE)')}</b></td>
                      <td style={td()}>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <div style={{width:24, height:24, borderRadius:6, background:s?.color||'#4f46e5', color:'#fff', display:'grid', placeItems:'center', fontSize:11, fontWeight:700}}>
                            {s?.name?.charAt(0) || '?'}
                          </div>
                          <span>{s?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={td()}>{prettyTime(ex.start_time)}</td>
                      <td style={td()}>
                        <span style={
                          ex.status === 'completed' ? statusBadge('#dcfce7','#047857','✓ Completed') :
                          ex.status === 'absent' ? statusBadge('#fee2e2','#b91c1c','✕ Absent') :
                          statusBadge('#fef3c7','#b45309', ex.status)
                        }>
                          {ex.status}
                        </span>
                      </td>
                      <td style={td()}><span style={{color:'#64748b', fontSize:12}}>{ex.note || '—'}</span></td>
                      <td style={td()}>
                        <button
                          type="button"
                          onClick={() => deleteException(ex.id)}
                          style={{border:'none', background:'none', color:'#ef4444', cursor:'pointer', padding:4}}
                          title="Delete record"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        )}
      </div>

      {/* Note Modal */}
      {noteModal && (
        <Modal title="Lesson / Attendance Note" onClose={() => setNoteModal(null)}>
          <div className="form-grid">
            <div className="field" style={{gridColumn:'1/-1'}}>
              <label>Note (What was taught / reason for absence / homework)</label>
              <textarea
                className="textarea"
                rows={4}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="e.g. Chapter 4 completed, homework given from exercise 4.2"
                autoFocus
              />
            </div>
            <div style={{gridColumn:'1/-1', display:'flex', gap:10}}>
              <button className="btn btn-primary" onClick={saveNote} style={{flex:1}}>
                Save Note
              </button>
              <button className="btn btn-ghost" onClick={() => setNoteModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Extra Class Modal */}
      {extraModal && (
        <Modal title="Record Extra / Unscheduled Class" onClose={() => setExtraModal(false)}>
          <form action={handleAddExtra} className="form-grid">
            <div className="field" style={{gridColumn:'1/-1'}}>
              <label>Student</label>
              <select className="select" name="student_id" required>
                {activeStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.subject || 'Tutoring'})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" name="class_date" defaultValue={dateKey} required/>
            </div>
            <div className="field">
              <label>Start Time</label>
              <input className="input" type="time" name="start_time" defaultValue="07:00" required/>
            </div>
            <div className="field">
              <label>Duration (minutes)</label>
              <input className="input" type="number" name="duration_minutes" defaultValue={60} min={15} step={15}/>
            </div>
            <div className="field">
              <label>Attendance Status</label>
              <select className="select" name="status" defaultValue="completed">
                <option value="completed">Completed (Present)</option>
                <option value="absent">Student Absent</option>
                <option value="cancelled">Cancelled / Off</option>
                <option value="missed">Missed</option>
              </select>
            </div>
            <div className="field" style={{gridColumn:'1/-1'}}>
              <label>Note / Lesson details (Optional)</label>
              <textarea className="textarea" name="note" rows={2} placeholder="e.g. Extra revision class before exam"/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <button className="btn btn-primary" type="submit" style={{width:'100%', padding:12}}>
                ✓ Save Class Record
              </button>
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
      <AttendanceContent/>
    </ProtectedLayout>
  )
}

function statusBadge(bg: string, color: string, label: string) {
  return {background: bg, color, fontSize: 11, padding: '3px 8px', borderRadius: 999, fontWeight: 700, display:'inline-block'}
}
function th() {
  return {padding:'10px 14px', fontSize:11, color:'#64748b', textTransform:'uppercase' as const, letterSpacing:'.04em', fontWeight:700, textAlign:'left' as const}
}
function td() {
  return {padding:'12px 14px', fontSize:13}
}

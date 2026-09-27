'use client'
import {useMemo,useState} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import {useData} from '@/components/DataProvider'
import {DAYS,prettyTime,minutesFromTime,timeFromMinutes} from '@/lib/utils'
import {addDays,format,startOfWeek,subWeeks,addWeeks} from 'date-fns'
import {ChevronLeft,ChevronRight,Plus,Trash2,Check} from 'lucide-react'

const DAY_PRESETS = [
  { label: 'Sat / Mon / Wed', days: [0, 2, 4] },
  { label: 'Sun / Tue / Thu', days: [1, 3, 5] },
  { label: 'Fri / Sat', days: [6, 0] },
  { label: 'Everyday', days: [0, 1, 2, 3, 4, 5, 6] },
]

function CalendarContent(){
  const {students,schedules,exceptions,settings,saveSchedule,saveSchedulesBulk,deleteSchedule,saveException}=useData()
  const [week,setWeek]=useState(new Date())
  const [modal,setModal]=useState(false)
  const [selected,setSelected]=useState<any>(null)
  const [query,setQuery]=useState('')
  const [moveModal,setMoveModal]=useState(false)
  const [moveDate,setMoveDate]=useState('')
  const [moveTime,setMoveTime]=useState('')

  // Add class state
  const activeStudents = students.filter(s=>!s.archived)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [selectedDays, setSelectedDays] = useState<number[]>([0]) // default Saturday
  const [startTime, setStartTime] = useState<string>('07:00')
  const [duration, setDuration] = useState<number>(settings.default_duration_minutes || 60)

  const sat=addDays(startOfWeek(week,{weekStartsOn:0}),-1)
  const dates=Array.from({length:7},(_,i)=>addDays(sat,i))

  // Auto set initial student when modal opens
  function openAddModal(){
    const firstId = activeStudents[0]?.id || ''
    setSelectedStudentId(firstId)
    setSelectedDays([0])
    setStartTime('07:00')
    setDuration(settings.default_duration_minutes || 60)
    setModal(true)
  }

  // Only show time slots that have at least one class
  const slots=useMemo(()=>{
    const used=new Set<string>()
    schedules.filter(s => s.active !== false).forEach(s=>{
      if (s.start_time) used.add(s.start_time.slice(0,5))
    })
    exceptions.forEach(e=>{
      if (e.start_time) used.add(e.start_time.slice(0,5))
    })
    if(!used.size){
      const a:string[]=[]
      for(let m=minutesFromTime(settings.day_start||'07:00');m<minutesFromTime(settings.day_end||'22:00');m+=(settings.interval_minutes||60))
        a.push(timeFromMinutes(m))
      return a
    }
    return Array.from(used).sort()
  },[settings,schedules,exceptions])

  function studentName(id:string){return students.find(s=>s.id===id)?.name||'Student'}

  function exFor(student_id:string,date:string,start:string){
    return exceptions.find(e=>e.student_id===student_id&&e.class_date===date&&e.start_time.slice(0,5)===start.slice(0,5))
  }

  function eventsFor(day:number,slot:string,date:string): any[] {
    const cleanSlot = slot.slice(0,5)
    
    // Regular weekly schedules
    const regular = schedules
      .filter(s => Number(s.day_of_week) === Number(day) && s.start_time.slice(0,5) === cleanSlot && s.active !== false && studentName(s.student_id).toLowerCase().includes(query.toLowerCase()))
      .filter(s => {
        const ex = exFor(s.student_id, date, cleanSlot)
        return !ex || !['off','cancelled','rescheduled','missed'].includes(ex.status)
      })
      .map(s => ({
        ...s,
        student: s.student || students.find(st => st.id === s.student_id),
        date
      }))

    // Rescheduled or extra classes scheduled for this date & slot
    const extras = exceptions
      .filter(e => e.class_date === date && e.start_time.slice(0,5) === cleanSlot && ['scheduled','completed'].includes(e.status) && studentName(e.student_id).toLowerCase().includes(query.toLowerCase()))
      .map(e => ({
        id: e.id,
        student_id: e.student_id,
        student: e.student || students.find(st => st.id === e.student_id),
        start_time: e.start_time.slice(0,5),
        duration_minutes: e.duration_minutes || 60,
        day_of_week: day,
        date: e.class_date,
        is_exception: true
      }))

    return [...regular, ...extras]
  }

  function overlap(day:number,slot:string){
    return schedules.filter(s=>Number(s.day_of_week)===Number(day)&&s.start_time.slice(0,5)===slot.slice(0,5)&&s.active!==false).length>1
  }

  function toggleDay(dayIndex: number){
    setSelectedDays(prev => 
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort((a,b)=>a-b)
    )
  }

  async function handleAddClasses(e: React.FormEvent){
    e.preventDefault()
    if(!selectedStudentId){
      alert('Please select a student')
      return
    }
    if(selectedDays.length === 0){
      alert('Please select at least one day (কবে কোন দিন পড়াবেন সিলেক্ট করুন)')
      return
    }

    const items = selectedDays.map(day => ({
      student_id: selectedStudentId,
      day_of_week: Number(day),
      start_time: startTime.slice(0,5),
      duration_minutes: Number(duration)
    }))

    await saveSchedulesBulk(items)
    setModal(false)
  }

  async function doMove(){
    if(!selected||!moveDate||!moveTime)return
    await saveException({
      schedule_id:selected.id,
      student_id:selected.student_id,
      class_date:selected.date,
      start_time:selected.start_time.slice(0,5),
      duration_minutes:selected.duration_minutes,
      status:'rescheduled',
      original_date:selected.date
    })
    await saveException({
      student_id:selected.student_id,
      class_date:moveDate,
      start_time:moveTime.slice(0,5),
      duration_minutes:selected.duration_minutes,
      status:'scheduled',
      original_date:selected.date
    })
    setSelected(null)
    setMoveModal(false)
  }

  function openMove(){
    if(!selected)return
    setMoveDate(selected.date)
    setMoveTime(selected.start_time.slice(0,5))
    setMoveModal(true)
  }

  const currentStudentSchedules = schedules.filter(s => s.student_id === selectedStudentId && s.active !== false)

  return <>
    <Topbar 
      title="Weekly Calendar" 
      subtitle="Select multiple days for weekly tutoring · compact class view" 
      actions={<button className="btn btn-primary" onClick={openAddModal}><Plus size={16}/> Add class</button>}
    />
    
    <div className="toolbar">
      <div className="week-nav">
        <button className="btn btn-ghost" onClick={()=>setWeek(subWeeks(week,1))}><ChevronLeft size={16}/></button>
        <b>{format(dates[0],'d MMM')} – {format(dates[6],'d MMM yyyy')}</b>
        <button className="btn btn-ghost" onClick={()=>setWeek(addWeeks(week,1))}><ChevronRight size={16}/></button>
      </div>
      <input className="input" style={{maxWidth:260}} placeholder="Search student…" value={query} onChange={e=>setQuery(e.target.value)}/>
      {selected&&<span className="badge red">Selected: {studentName(selected.student_id)}</span>}
    </div>

    <div className="calendar-wrap">
      <div className="calendar" style={{['--cols' as any]:slots.length}}>
        <div className="cal-header">
          <div className="cal-day">Day / Time</div>
          {slots.map(t=><div className="cal-time" key={t}>{prettyTime(t)}</div>)}
        </div>
        {DAYS.map((day,di)=>(
          <div className="cal-row" key={day}>
            <div className="cal-day">{day}<div className="sub">{format(dates[di],'d MMM')}</div></div>
            {slots.map(slot=>{
              const ev=eventsFor(di,slot,format(dates[di],'yyyy-MM-dd'))
              return (
                <div className="cal-cell" key={slot}>
                  {ev.map((e: any)=>(
                    <div 
                      key={e.id} 
                      className={'event '+(overlap(di,slot)?'conflict':'')} 
                      style={{
                        background:e.student?.color||students.find(s=>s.id===e.student_id)?.color||'#4f46e5',
                        outline:selected?.id===e.id?'2px solid #fff':undefined,
                        opacity:selected&&selected.id!==e.id?0.6:1,
                        cursor:'pointer'
                      }} 
                      onClick={x=>{x.stopPropagation();setSelected(selected?.id===e.id?null:{...e,date:format(dates[di],'yyyy-MM-dd')})}}
                    >
                      <div className="name">{studentName(e.student_id)}</div>
                      <div className="time">{prettyTime(e.start_time)} · {e.duration_minutes}m</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>

    {/* Selected class action panel */}
    {selected&&(
      <div className="card" style={{position:'fixed',right:20,bottom:20,zIndex:30,maxWidth:360,boxShadow:'0 10px 25px rgba(0,0,0,0.15)',borderRadius:14,border:'1px solid #e2e8f0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
          <div>
            <b style={{fontSize:16}}>{studentName(selected.student_id)}</b>
            <div className="sub">{selected.date} ({DAYS[selected.day_of_week]}) · {prettyTime(selected.start_time)} ({selected.duration_minutes}m)</div>
          </div>
          <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:12}} onClick={()=>setSelected(null)}>✕</button>
        </div>
        <div className="toolbar" style={{margin:'12px 0 0',display:'flex',gap:6,flexWrap:'wrap'}}>
          <button className="btn btn-primary" onClick={openMove}>Move to…</button>
          <button className="btn btn-soft" onClick={async()=>{await saveException({schedule_id:selected.id,student_id:selected.student_id,class_date:selected.date,start_time:selected.start_time.slice(0,5),duration_minutes:selected.duration_minutes,status:'off'});setSelected(null)}}>Off today</button>
          <button className="btn btn-ghost" style={{color:'#dc2626'}} onClick={async()=>{if(confirm('Remove this weekly schedule slot?')){await deleteSchedule(selected.id);setSelected(null)}}}>Delete</button>
        </div>
      </div>
    )}

    {/* Move modal with date+time picker */}
    {moveModal&&selected&&(
      <Modal title={`Move ${studentName(selected.student_id)}'s class`} onClose={()=>setMoveModal(false)}>
        <div className="form-grid">
          <div className="field"><label>New Date</label><input className="input" type="date" value={moveDate} onChange={e=>setMoveDate(e.target.value)}/></div>
          <div className="field"><label>New Time</label><input className="input" type="time" value={moveTime} onChange={e=>setMoveTime(e.target.value)}/></div>
          <div style={{gridColumn:'1/-1'}}><button className="btn btn-primary" onClick={doMove}>✓ Confirm Move</button></div>
        </div>
      </Modal>
    )}

    {/* Add weekly class modal with multi-day list selector */}
    {modal&&(
      <Modal title="Add weekly schedule" onClose={()=>setModal(false)}>
        <form onSubmit={handleAddClasses} className="form-grid">
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label>Student</label>
            <select 
              className="select" 
              value={selectedStudentId} 
              onChange={e=>setSelectedStudentId(e.target.value)}
              required
            >
              {activeStudents.map(s=>(
                <option key={s.id} value={s.id}>{s.name} {s.subject ? `(${s.subject})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Multi-select Days Section */}
          <div className="field" style={{gridColumn:'1/-1'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <label style={{fontWeight:700,color:'#1e293b'}}>Select Days (কবে কোন দিন পড়াবেন):</label>
              <span style={{fontSize:12,color:'#6366f1',fontWeight:600}}>
                {selectedDays.length} {selectedDays.length === 1 ? 'day' : 'days'} selected
              </span>
            </div>

            {/* Quick Presets */}
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
              {DAY_PRESETS.map(p=>(
                <button
                  type="button"
                  key={p.label}
                  onClick={()=>setSelectedDays(p.days)}
                  style={{
                    padding:'4px 10px',
                    fontSize:11,
                    fontWeight:600,
                    borderRadius:999,
                    border:'1px solid #e2e8f0',
                    background:'#f8fafc',
                    color:'#475569',
                    cursor:'pointer'
                  }}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={()=>setSelectedDays([])}
                style={{
                  padding:'4px 10px',
                  fontSize:11,
                  fontWeight:600,
                  borderRadius:999,
                  border:'1px dashed #cbd5e1',
                  background:'transparent',
                  color:'#94a3b8',
                  cursor:'pointer'
                }}
              >
                Clear
              </button>
            </div>

            {/* Day list checkboxes / interactive pill badges */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))',gap:8}}>
              {DAYS.map((d, index)=>{
                const isSelected = selectedDays.includes(index)
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={()=>toggleDay(index)}
                    style={{
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      gap:6,
                      padding:'10px 8px',
                      borderRadius:10,
                      fontWeight:700,
                      fontSize:13,
                      cursor:'pointer',
                      transition:'all .15s ease',
                      border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      background: isSelected ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : '#fff',
                      color: isSelected ? '#fff' : '#334155',
                      boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none',
                    }}
                  >
                    {isSelected && <Check size={14} />}
                    {d.slice(0, 3)}
                  </button>
                )
              })}
            </div>

            {selectedDays.length > 0 && (
              <div style={{fontSize:12,color:'#475569',marginTop:8,background:'#f1f5f9',padding:'6px 10px',borderRadius:6}}>
                <b>Selected:</b> {selectedDays.map(i => DAYS[i]).join(', ')}
              </div>
            )}
          </div>

          <div className="field">
            <label>Start time</label>
            <input 
              className="input" 
              type="time" 
              value={startTime} 
              onChange={e=>setStartTime(e.target.value)} 
              required
            />
          </div>

          <div className="field">
            <label>Duration (minutes)</label>
            <input 
              className="input" 
              type="number" 
              value={duration} 
              onChange={e=>setDuration(Number(e.target.value))} 
              min="15" 
              step="15" 
              required
            />
          </div>

          {/* Existing weekly classes for this student */}
          {currentStudentSchedules.length > 0 && (
            <div style={{gridColumn:'1/-1',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:12}}>
              <div style={{fontSize:12,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase',letterSpacing:'.04em'}}>
                Current weekly schedule for {studentName(selectedStudentId)}:
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {currentStudentSchedules.map(cs=>(
                  <div 
                    key={cs.id} 
                    style={{
                      display:'flex',
                      alignItems:'center',
                      gap:6,
                      background:'#fff',
                      border:'1px solid #cbd5e1',
                      borderRadius:6,
                      padding:'4px 8px',
                      fontSize:12
                    }}
                  >
                    <b>{DAYS[cs.day_of_week]}:</b> {prettyTime(cs.start_time)} ({cs.duration_minutes}m)
                    <button 
                      type="button" 
                      onClick={()=>deleteSchedule(cs.id)} 
                      style={{border:'none',background:'none',color:'#ef4444',cursor:'pointer',padding:0,display:'flex'}}
                      title="Delete slot"
                    >
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{gridColumn:'1/-1',marginTop:8}}>
            <button 
              className="btn btn-primary" 
              type="submit" 
              style={{width:'100%',padding:12,fontSize:14,fontWeight:700}}
              disabled={selectedDays.length === 0}
            >
              ✓ Save {selectedDays.length} Weekly Class{selectedDays.length > 1 ? 'es' : ''}
            </button>
          </div>
        </form>
      </Modal>
    )}
  </>
}

export default function Page(){
  return (
    <ProtectedLayout>
      <CalendarContent/>
    </ProtectedLayout>
  )
}

'use client'
import {useMemo,useState} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import {useData} from '@/components/DataProvider'
import {DAYS,prettyTime,minutesFromTime,timeFromMinutes} from '@/lib/utils'
import {addDays,format,startOfWeek,subWeeks,addWeeks} from 'date-fns'
import {ChevronLeft,ChevronRight,Plus,Trash2,Check,Clock,Calendar as CalIcon,RefreshCw,Sparkles,AlertTriangle,CheckCircle2,Info} from 'lucide-react'

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
  
  // Move / Reschedule modal state
  const [rescheduleType, setRescheduleType] = useState<'temporary' | 'permanent'>('temporary')
  const [moveDate,setMoveDate]=useState('')
  const [moveTime,setMoveTime]=useState('')
  const [moveDay,setMoveDay]=useState<number>(0)
  const [moveDuration,setMoveDuration]=useState<number>(60)

  // Add class state
  const activeStudents = students.filter(s=>!s.archived)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [selectedDays, setSelectedDays] = useState<number[]>([0]) // default Saturday
  const [startTime, setStartTime] = useState<string>('07:00')
  const [duration, setDuration] = useState<number>(settings.default_duration_minutes || 60)
  const [showDayBreakdown, setShowDayBreakdown] = useState(false)

  const sat=addDays(startOfWeek(week,{weekStartsOn:0}),-1)
  const dates=Array.from({length:7},(_,i)=>addDays(sat,i))

  function studentName(id:string){return students.find(s=>s.id===id)?.name||'Student'}

  // Auto set initial student when modal opens
  function openAddModal(prefillDay?: number, prefillTime?: string){
    const firstId = activeStudents[0]?.id || ''
    setSelectedStudentId(firstId)
    setSelectedDays(prefillDay !== undefined ? [prefillDay] : [0])
    setStartTime(prefillTime || '07:00')
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

  // --- FREE SLOTS & CONFLICT CALCULATION ---
  const freeSlotsAnalysis = useMemo(() => {
    if (!selectedDays.length) return { commonFree: [], conflicts: [], dayDetails: [] }

    const dayStartM = minutesFromTime(settings.day_start || '07:00')
    const dayEndM = minutesFromTime(settings.day_end || '22:00')
    const step = 30 // test every 30 minutes
    const testDur = duration || 60

    // Candidates
    const candidateTimes: string[] = []
    for (let m = dayStartM; m + testDur <= dayEndM; m += step) {
      candidateTimes.push(timeFromMinutes(m))
    }

    // Check which candidate times are free across ALL selected days
    const commonFree = candidateTimes.filter(candTime => {
      const candStartM = minutesFromTime(candTime)
      const candEndM = candStartM + testDur

      // Must be free in ALL selected days
      return selectedDays.every(day => {
        const dayClasses = schedules.filter(s => Number(s.day_of_week) === Number(day) && s.active !== false)
        return dayClasses.every(s => {
          const sStart = minutesFromTime(s.start_time)
          const sEnd = sStart + s.duration_minutes
          // Overlap condition: not (end <= sStart or start >= sEnd)
          const isOverlapping = !(candEndM <= sStart || candStartM >= sEnd)
          return !isOverlapping
        })
      })
    })

    // Current selected time conflict check
    const currentStartM = minutesFromTime(startTime)
    const currentEndM = currentStartM + testDur
    const conflicts: Array<{ day: number; student_name: string; time: string; duration: number }> = []

    selectedDays.forEach(day => {
      const dayClasses = schedules.filter(s => Number(s.day_of_week) === Number(day) && s.active !== false)
      dayClasses.forEach(s => {
        const sStart = minutesFromTime(s.start_time)
        const sEnd = sStart + s.duration_minutes
        const isOverlapping = !(currentEndM <= sStart || currentStartM >= sEnd)
        if (isOverlapping) {
          conflicts.push({
            day,
            student_name: studentName(s.student_id),
            time: prettyTime(s.start_time),
            duration: s.duration_minutes
          })
        }
      })
    })

    // Breakdown for each selected day
    const dayDetails = selectedDays.map(day => {
      const dayClasses = schedules
        .filter(s => Number(s.day_of_week) === Number(day) && s.active !== false)
        .sort((a,b) => a.start_time.localeCompare(b.start_time))
      
      return {
        dayIndex: day,
        dayName: DAYS[day],
        classes: dayClasses.map(c => ({
          studentName: studentName(c.student_id),
          time: prettyTime(c.start_time),
          duration: c.duration_minutes
        }))
      }
    })

    return { commonFree, conflicts, dayDetails }
  }, [selectedDays, duration, startTime, schedules, settings, students])

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

  function openMove(type: 'temporary' | 'permanent' = 'temporary'){
    if(!selected)return
    setRescheduleType(type)
    setMoveDate(selected.date)
    setMoveTime(selected.start_time.slice(0,5))
    setMoveDay(Number(selected.day_of_week ?? 0))
    setMoveDuration(Number(selected.duration_minutes || 60))
    setMoveModal(true)
  }

  async function doReschedule(e: React.FormEvent){
    e.preventDefault()
    if(!selected || !moveTime) return

    if(rescheduleType === 'permanent'){
      await saveSchedule({
        id: selected.is_exception ? undefined : selected.id,
        student_id: selected.student_id,
        day_of_week: Number(moveDay),
        start_time: moveTime.slice(0,5),
        duration_minutes: Number(moveDuration)
      })
    } else {
      await saveException({
        schedule_id: selected.id,
        student_id: selected.student_id,
        class_date: selected.date,
        start_time: selected.start_time.slice(0,5),
        duration_minutes: selected.duration_minutes,
        status: 'rescheduled',
        original_date: selected.date
      })
      await saveException({
        student_id: selected.student_id,
        class_date: moveDate,
        start_time: moveTime.slice(0,5),
        duration_minutes: Number(moveDuration),
        status: 'scheduled',
        original_date: selected.date
      })
    }

    setSelected(null)
    setMoveModal(false)
  }

  const currentStudentSchedules = schedules.filter(s => s.student_id === selectedStudentId && s.active !== false)

  return <>
    <Topbar 
      title="Weekly Calendar" 
      subtitle="Click any class to manage · or add new classes with smart free-slot finder" 
      actions={
        <button className="btn btn-primary" onClick={() => openAddModal()}>
          <Plus size={16}/> Add class
        </button>
      }
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
                <div 
                  className="cal-cell" 
                  key={slot}
                  onDoubleClick={() => openAddModal(di, slot)}
                  title="Double click to add a class at this time"
                >
                  {ev.map((e: any)=>(
                    <div 
                      key={e.id} 
                      className={'event '+(overlap(di,slot)?'conflict':'')} 
                      style={{
                        background:e.student?.color||students.find(s=>s.id===e.student_id)?.color||'#4f46e5',
                        outline:selected?.id===e.id?'3px solid #000':undefined,
                        boxShadow:selected?.id===e.id?'0 0 0 2px #fff, 0 6px 16px rgba(0,0,0,0.3)':undefined,
                        opacity:selected&&selected.id!==e.id?0.5:1,
                        cursor:'pointer',
                        transform:selected?.id===e.id?'scale(1.02)':'none',
                        transition:'all .15s ease'
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

    {/* Selected class action floating panel with direct time change */}
    {selected&&(
      <div className="card" style={{position:'fixed',right:20,bottom:20,zIndex:40,maxWidth:380,width:'90%',boxShadow:'0 12px 32px rgba(15,23,42,0.2)',borderRadius:16,border:'2px solid #6366f1',background:'#fff'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{
              width:38,height:38,borderRadius:10,
              background:selected.student?.color||students.find(s=>s.id===selected.student_id)?.color||'#4f46e5',
              color:'#fff',display:'grid',placeItems:'center',fontWeight:800,fontSize:14
            }}>
              {studentName(selected.student_id).charAt(0)}
            </div>
            <div>
              <b style={{fontSize:16,display:'block',color:'#0f172a'}}>{studentName(selected.student_id)}</b>
              <div className="sub" style={{fontSize:12}}>
                {selected.date} ({DAYS[selected.day_of_week]}) · <b>{prettyTime(selected.start_time)}</b> ({selected.duration_minutes}m)
              </div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:12,borderRadius:8}} onClick={()=>setSelected(null)}>✕</button>
        </div>

        {/* Quick Action Buttons */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginTop:12}}>
          <button 
            className="btn btn-primary" 
            style={{padding:'9px 10px',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}
            onClick={()=>openMove('temporary')}
          >
            <Clock size={14}/> এই দিনের টাইম চেঞ্জ
          </button>
          
          <button 
            className="btn btn-soft" 
            style={{padding:'9px 10px',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6,color:'#4338ca'}}
            onClick={()=>openMove('permanent')}
          >
            <RefreshCw size={13}/> স্থায়ী রুটিন চেঞ্জ
          </button>
        </div>

        <div style={{display:'flex',gap:6,marginTop:8}}>
          <button 
            className="btn btn-ghost" 
            style={{flex:1,padding:'7px 10px',fontSize:12}} 
            onClick={async()=>{
              await saveException({
                schedule_id:selected.id,
                student_id:selected.student_id,
                class_date:selected.date,
                start_time:selected.start_time.slice(0,5),
                duration_minutes:selected.duration_minutes,
                status:'off'
              });
              setSelected(null)
            }}
          >
            ⏸️ Off today
          </button>
          
          <button 
            className="btn btn-ghost" 
            style={{padding:'7px 12px',fontSize:12,color:'#dc2626'}} 
            onClick={async()=>{
              if(confirm('Delete this weekly schedule slot for ' + studentName(selected.student_id) + '?')){
                await deleteSchedule(selected.id);
                setSelected(null);
              }
            }}
          >
            <Trash2 size={13} style={{display:'inline',marginRight:4,verticalAlign:-2}}/> Delete
          </button>
        </div>
      </div>
    )}

    {/* Unified Move & Time Change Modal */}
    {moveModal&&selected&&(
      <Modal 
        title={`Change Time — ${studentName(selected.student_id)}`} 
        onClose={()=>setMoveModal(false)}
      >
        <form onSubmit={doReschedule} className="form-grid">
          {/* Mode Selector Tabs */}
          <div style={{gridColumn:'1/-1',marginBottom:6}}>
            <label style={{fontWeight:700,fontSize:13,display:'block',marginBottom:8,color:'#1e293b'}}>
              কীভাবে টাইম পরিবর্তন করতে চান?
            </label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
              <div 
                onClick={()=>setRescheduleType('temporary')}
                style={{
                  border: rescheduleType === 'temporary' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  background: rescheduleType === 'temporary' ? '#eef2ff' : '#fff',
                  borderRadius:12,
                  padding:'12px 14px',
                  cursor:'pointer',
                  transition:'all .15s ease'
                }}
              >
                <div style={{display:'flex',alignItems:'center',gap:6,fontWeight:700,fontSize:14,color:rescheduleType==='temporary'?'#4338ca':'#1e293b'}}>
                  <CalIcon size={16}/> শুধু ১ দিনের জন্য
                </div>
                <div style={{fontSize:12,color:'#64748b',marginTop:4}}>
                  শুধুমাত্র {selected.date} তারিখের ক্লাসের সময় রিশিডিউল হবে।
                </div>
              </div>

              <div 
                onClick={()=>setRescheduleType('permanent')}
                style={{
                  border: rescheduleType === 'permanent' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  background: rescheduleType === 'permanent' ? '#eef2ff' : '#fff',
                  borderRadius:12,
                  padding:'12px 14px',
                  cursor:'pointer',
                  transition:'all .15s ease'
                }}
              >
                <div style={{display:'flex',alignItems:'center',gap:6,fontWeight:700,fontSize:14,color:rescheduleType==='permanent'?'#4338ca':'#1e293b'}}>
                  <RefreshCw size={15}/> স্থায়ীভাবে সব সপ্তাহের জন্য
                </div>
                <div style={{fontSize:12,color:'#64748b',marginTop:4}}>
                  প্রতি সপ্তাহের রুটিন পারমানেন্টলি এই নতুন টাইমে আপডেট হবে।
                </div>
              </div>
            </div>
          </div>

          {rescheduleType === 'temporary' ? (
            <>
              <div className="field">
                <label>New Date</label>
                <input 
                  className="input" 
                  type="date" 
                  value={moveDate} 
                  onChange={e=>setMoveDate(e.target.value)} 
                  required
                />
              </div>
              <div className="field">
                <label>New Start Time</label>
                <input 
                  className="input" 
                  type="time" 
                  value={moveTime} 
                  onChange={e=>setMoveTime(e.target.value)} 
                  required
                />
              </div>
              <div className="field" style={{gridColumn:'1/-1'}}>
                <label>Duration (minutes)</label>
                <input 
                  className="input" 
                  type="number" 
                  value={moveDuration} 
                  onChange={e=>setMoveDuration(Number(e.target.value))} 
                  min="15" 
                  step="15" 
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label>Weekly Day</label>
                <select 
                  className="select" 
                  value={moveDay} 
                  onChange={e=>setMoveDay(Number(e.target.value))}
                >
                  {DAYS.map((d,i)=>(
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>New Start Time</label>
                <input 
                  className="input" 
                  type="time" 
                  value={moveTime} 
                  onChange={e=>setMoveTime(e.target.value)} 
                  required
                />
              </div>
              <div className="field" style={{gridColumn:'1/-1'}}>
                <label>Duration (minutes)</label>
                <input 
                  className="input" 
                  type="number" 
                  value={moveDuration} 
                  onChange={e=>setMoveDuration(Number(e.target.value))} 
                  min="15" 
                  step="15" 
                  required
                />
              </div>
            </>
          )}

          <div style={{gridColumn:'1/-1',marginTop:8}}>
            <button 
              className="btn btn-primary" 
              type="submit" 
              style={{width:'100%',padding:12,fontSize:14,fontWeight:700}}
            >
              ✓ {rescheduleType === 'permanent' ? 'স্থায়ীভাবে রুটিন পরিবর্তন করুন' : 'শুধু এই ক্লাসের সময় পরিবর্তন করুন'}
            </button>
          </div>
        </form>
      </Modal>
    )}

    {/* Add weekly class modal with SMART FREE SLOTS FINDER */}
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

            {/* Day list checkboxes */}
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
          </div>

          {/* Available Free Slots for Selected Days */}
          {selectedDays.length > 0 && (
            <div style={{gridColumn:'1/-1',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:'12px 14px'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,fontWeight:700,fontSize:13,color:'#166534',marginBottom:6}}>
                <Sparkles size={15} style={{color:'#15803d'}}/> 
                সিলেক্ট করা দিনগুলোর ফাঁকা সময়সমূহ (Available Free Slots):
              </div>
              
              {freeSlotsAnalysis.commonFree.length > 0 ? (
                <>
                  <div style={{fontSize:12,color:'#15803d',marginBottom:8}}>
                    নিচের যেকোনো ফাঁকা সময়ে ক্লিক করলে স্বয়ংক্রিয়ভাবে টাইম সেট হয়ে যাবে:
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {freeSlotsAnalysis.commonFree.slice(0, 12).map(ft => {
                      const isSelectedTime = startTime.slice(0,5) === ft.slice(0,5)
                      return (
                        <button
                          type="button"
                          key={ft}
                          onClick={() => setStartTime(ft)}
                          style={{
                            padding:'5px 10px',
                            borderRadius:8,
                            fontSize:12,
                            fontWeight:700,
                            cursor:'pointer',
                            transition:'all .15s ease',
                            border: isSelectedTime ? '2px solid #15803d' : '1px solid #86efac',
                            background: isSelectedTime ? '#15803d' : '#fff',
                            color: isSelectedTime ? '#fff' : '#166534',
                            boxShadow: isSelectedTime ? '0 2px 8px rgba(21,128,61,0.3)' : 'none'
                          }}
                        >
                          {isSelectedTime && '✓ '}
                          {prettyTime(ft)}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div style={{fontSize:12,color:'#b45309'}}>
                  ⚠️ সিলেক্ট করা সব দিনগুলোতে একই সাথে কমন কোনো ফ্রি স্লট নেই। আপনি নিজে নিচে আলাদা টাইম দিতে পারেন।
                </div>
              )}
            </div>
          )}

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

          {/* Real-time Conflict Check Warning / Success */}
          {selectedDays.length > 0 && (
            <div style={{gridColumn:'1/-1'}}>
              {freeSlotsAnalysis.conflicts.length > 0 ? (
                <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'flex-start',gap:8,fontSize:12,color:'#92400e'}}>
                  <AlertTriangle size={16} style={{color:'#d97706',flexShrink:0,marginTop:2}}/>
                  <div>
                    <b>⚠️ সময় কনফ্লিক্ট detected ({prettyTime(startTime)}):</b>
                    <ul style={{margin:'4px 0 0',paddingLeft:18}}>
                      {freeSlotsAnalysis.conflicts.map((c, idx) => (
                        <li key={idx}>
                          <b>{DAYS[c.day]}:</b> ইতিমধ্যে <b>{c.student_name}</b> এর ক্লাস আছে ({c.time} · {c.duration}m)
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div style={{background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:10,padding:'8px 12px',display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#065f46'}}>
                  <CheckCircle2 size={16} style={{color:'#059669',flexShrink:0}}/>
                  <span>
                    <b>{prettyTime(startTime)}</b> সময়টি সিলেক্ট করা <b>{selectedDays.length}টি দিনেই সম্পূর্ণ ফাঁকা</b> রয়েছে! ✅
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Toggle Day-by-Day Schedule Breakdown */}
          {selectedDays.length > 0 && (
            <div style={{gridColumn:'1/-1'}}>
              <button
                type="button"
                onClick={() => setShowDayBreakdown(!showDayBreakdown)}
                style={{
                  border:'none',background:'none',color:'#4f46e5',fontSize:12,fontWeight:700,cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:4
                }}
              >
                <Info size={14}/> {showDayBreakdown ? 'সিলেক্ট করা দিনগুলোর শিডিউল লুকান ▲' : 'সিলেক্ট করা দিনগুলোতে কার কার ক্লাস আছে দেখুন ▼'}
              </button>

              {showDayBreakdown && (
                <div style={{marginTop:8,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:10,display:'flex',flexDirection:'column',gap:6}}>
                  {freeSlotsAnalysis.dayDetails.map(d => (
                    <div key={d.dayIndex} style={{fontSize:12,borderBottom:'1px solid #f1f5f9',paddingBottom:4}}>
                      <b style={{color:'#1e293b'}}>{d.dayName}:</b>{' '}
                      {d.classes.length > 0 ? (
                        <span>{d.classes.map(c => `${c.studentName} (${c.time})`).join(', ')}</span>
                      ) : (
                        <span style={{color:'#059669',fontWeight:600}}>পুরো দিনই সম্পূর্ণ ফাঁকা 🟢</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

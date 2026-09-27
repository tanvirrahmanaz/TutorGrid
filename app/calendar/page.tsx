'use client'
import {useMemo,useState} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import {useData} from '@/components/DataProvider'
import {DAYS,prettyTime,minutesFromTime,timeFromMinutes} from '@/lib/utils'
import {addDays,format,startOfWeek,subWeeks,addWeeks} from 'date-fns'
import {ChevronLeft,ChevronRight,Plus,Trash2,Check,Clock,Calendar as CalIcon,RefreshCw,Sparkles,AlertTriangle,CheckCircle2,Info,UserX} from 'lucide-react'

const DAY_PRESETS = [
  { label: 'Sat / Mon / Wed', days: [0, 2, 4] },
  { label: 'Sun / Tue / Thu', days: [1, 3, 5] },
  { label: 'Fri / Sat', days: [6, 0] },
  { label: 'Everyday', days: [0, 1, 2, 3, 4, 5, 6] },
]

function CalendarContent(){
  const {students,schedules,exceptions,settings,saveSchedule,saveSchedulesBulk,deleteSchedule,deleteException,saveException}=useData()
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

  // Mobile-first View mode: 'agenda' (clean daily feed) vs 'grid' (full table)
  const [viewMode, setViewMode] = useState<'agenda' | 'grid'>('agenda')
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(() => {
    const js = new Date().getDay()
    return js === 6 ? 0 : js + 1 // today's TutorGrid day index
  })
  const [unscheduledExpanded, setUnscheduledExpanded] = useState(false)
  const [conflictsBannerExpanded, setConflictsBannerExpanded] = useState(false)

  const sat=addDays(startOfWeek(week,{weekStartsOn:0}),-1)
  const dates=Array.from({length:7},(_,i)=>addDays(sat,i))

  function studentName(id:string){return students.find(s=>s.id===id)?.name||'Student'}

  // Unscheduled students list (Active students who have NO weekly schedules)
  const unscheduledStudents = useMemo(() => {
    return activeStudents.filter(st => {
      return !schedules.some(s => s.student_id === st.id && s.active !== false)
    })
  }, [activeStudents, schedules])

  // Auto set initial student when modal opens
  function openAddModal(prefillDay?: number, prefillTime?: string, prefillStudentId?: string){
    const firstId = prefillStudentId || (unscheduledStudents[0]?.id) || (activeStudents[0]?.id) || ''
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

  // Count classes for each day of the week (to show on day pills)
  const classCountByDay = useMemo(() => {
    return dates.map((d, di) => {
      const dStr = format(d, 'yyyy-MM-dd')
      const reg = schedules.filter(s => Number(s.day_of_week) === di && s.active !== false).filter(s => {
        const ex = exFor(s.student_id, dStr, s.start_time)
        return !ex || !['off','cancelled','rescheduled','missed'].includes(ex.status)
      })
      const ext = exceptions.filter(e => e.class_date === dStr && ['scheduled','completed'].includes(e.status))
      return reg.length + ext.length
    })
  }, [dates, schedules, exceptions])

  // All classes scheduled for the selected day in Agenda view
  const selectedDateStr = format(dates[selectedDayIdx] || new Date(), 'yyyy-MM-dd')
  const agendaDayClasses = useMemo(() => {
    const reg = schedules
      .filter(s => Number(s.day_of_week) === Number(selectedDayIdx) && s.active !== false)
      .filter(s => {
        const ex = exFor(s.student_id, selectedDateStr, s.start_time)
        return !ex || !['off','cancelled','rescheduled','missed'].includes(ex.status)
      })
      .map(s => {
        const ex = exFor(s.student_id, selectedDateStr, s.start_time)
        return {
          ...s,
          student: s.student || students.find(st => st.id === s.student_id),
          date: selectedDateStr,
          exception: ex,
          is_exception: false
        }
      })

    const ext = exceptions
      .filter(e => e.class_date === selectedDateStr && ['scheduled','completed','rescheduled'].includes(e.status))
      .map(e => ({
        id: e.id,
        schedule_id: e.schedule_id,
        student_id: e.student_id,
        student: e.student || students.find(st => st.id === e.student_id),
        start_time: e.start_time.slice(0,5),
        duration_minutes: e.duration_minutes || 60,
        day_of_week: selectedDayIdx,
        date: e.class_date,
        is_exception: true,
        exception: e
      }))

    return [...reg, ...ext]
      .filter(c => studentName(c.student_id).toLowerCase().includes(query.toLowerCase()))
      .sort((a,b) => a.start_time.localeCompare(b.start_time))
  }, [schedules, exceptions, selectedDayIdx, selectedDateStr, query, students])

  // Return the specific classes that overlap with this class item
  function getDayConflicts(classItem: any) {
    const startM = minutesFromTime(classItem.start_time)
    const endM = startM + Number(classItem.duration_minutes || 60)
    return agendaDayClasses.filter(other => {
      if (other.id === classItem.id && other.student_id === classItem.student_id) return false
      const oStartM = minutesFromTime(other.start_time)
      const oEndM = oStartM + Number(other.duration_minutes || 60)
      return !(endM <= oStartM || startM >= oEndM)
    })
  }

  // Find the next available non-overlapping free time slots on this day for quick resolution
  function getAvailableFreeSlots(classItem: any, limit = 3): string[] {
    const durationMin = Number(classItem.duration_minutes || 60)
    const dayStartM = minutesFromTime(settings.day_start || '07:00')
    const dayEndM = minutesFromTime(settings.day_end || '22:00')
    const step = 30
    const free: string[] = []

    for (let m = dayStartM; m + durationMin <= dayEndM; m += step) {
      const candTime = timeFromMinutes(m)
      if (candTime === classItem.start_time.slice(0, 5)) continue

      const candEnd = m + durationMin
      const hasOverlap = agendaDayClasses.some(other => {
        if (other.id === classItem.id && other.student_id === classItem.student_id) return false
        const oStart = minutesFromTime(other.start_time)
        const oEnd = oStart + Number(other.duration_minutes || 60)
        return !(candEnd <= oStart || m >= oEnd)
      })

      if (!hasOverlap) {
        free.push(candTime)
        if (free.length >= limit) break
      }
    }
    return free
  }

  // 1-Click quick resolution: Move a conflicting class to an available free slot
  async function quickMoveToSlot(classItem: any, newStartTime: string, isPermanent = false) {
    if (isPermanent || !classItem.is_exception) {
      await saveSchedule({
        id: classItem.is_exception ? undefined : classItem.id,
        student_id: classItem.student_id,
        day_of_week: Number(classItem.day_of_week ?? selectedDayIdx),
        start_time: newStartTime.slice(0, 5),
        duration_minutes: Number(classItem.duration_minutes || 60)
      })
    } else {
      await saveException({
        schedule_id: classItem.schedule_id,
        student_id: classItem.student_id,
        class_date: classItem.date,
        start_time: newStartTime.slice(0, 5),
        duration_minutes: Number(classItem.duration_minutes || 60),
        status: 'scheduled',
        original_date: classItem.date
      })
    }
  }

  // Find all conflicting classes across the entire 7 days of the active week
  const weekConflictsList = useMemo(() => {
    const list: Array<{
      dayIndex: number;
      dayName: string;
      dateStr: string;
      student1: string;
      student2: string;
      time1: string;
      time2: string;
      class1: any;
      class2: any;
    }> = []

    dates.forEach((d, di) => {
      const dStr = format(d, 'yyyy-MM-dd')
      const reg = schedules
        .filter(s => Number(s.day_of_week) === di && s.active !== false)
        .filter(s => {
          const ex = exFor(s.student_id, dStr, s.start_time)
          return !ex || !['off','cancelled','rescheduled','missed'].includes(ex.status)
        })
        .map(s => ({
          ...s,
          date: dStr,
          is_exception: false
        }))

      const ext = exceptions
        .filter(e => e.class_date === dStr && ['scheduled','completed','rescheduled'].includes(e.status))
        .map(e => ({
          id: e.id,
          schedule_id: e.schedule_id,
          student_id: e.student_id,
          start_time: e.start_time.slice(0,5),
          duration_minutes: e.duration_minutes || 60,
          day_of_week: di,
          date: e.class_date,
          is_exception: true
        }))

      const allClasses = [...reg, ...ext]

      for (let i = 0; i < allClasses.length; i++) {
        for (let j = i + 1; j < allClasses.length; j++) {
          const c1 = allClasses[i]
          const c2 = allClasses[j]
          const s1 = minutesFromTime(c1.start_time)
          const e1 = s1 + Number(c1.duration_minutes || 60)
          const s2 = minutesFromTime(c2.start_time)
          const e2 = s2 + Number(c2.duration_minutes || 60)

          if (!(e1 <= s2 || s1 >= e2)) {
            list.push({
              dayIndex: di,
              dayName: DAYS[di],
              dateStr: dStr,
              student1: studentName(c1.student_id),
              student2: studentName(c2.student_id),
              time1: `${prettyTime(c1.start_time)} (${c1.duration_minutes}m)`,
              time2: `${prettyTime(c2.start_time)} (${c2.duration_minutes}m)`,
              class1: c1,
              class2: c2
            })
          }
        }
      }
    })
    return list
  }, [dates, schedules, exceptions, students])

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
  const isSelectedStudentUnscheduled = unscheduledStudents.some(st => st.id === selectedStudentId)

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

    {/* Weekly Conflicts Alert Banner */}
    {weekConflictsList.length > 0 && (
      <div style={{
        background:'#fff1f2',
        border:'1px solid #fecdd3',
        borderRadius:14,
        padding:'12px 14px',
        marginBottom:14,
        boxShadow:'0 2px 8px rgba(225, 29, 72, 0.08)'
      }}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8}}>
          <div style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#9f1239'}}>
            <AlertTriangle size={18} style={{color:'#e11d48', flexShrink:0}}/>
            <span>
              <b>⚠️ {weekConflictsList.length} টি ক্লাসে টাইমিং কনফ্লিক্ট (ওভারল্যাপ) রয়েছে!</b> একাধিক ছাত্রছাত্রীর সময় একসাথে মিলে গেছে।
            </span>
          </div>
          <button
            type="button"
            onClick={() => setConflictsBannerExpanded(!conflictsBannerExpanded)}
            style={{
              background: '#fff',
              border: '1px solid #e11d48',
              color: '#be123c',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {conflictsBannerExpanded ? 'Hide ▲' : 'View Conflicts & Fix ▼'}
          </button>
        </div>

        {conflictsBannerExpanded && (
          <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:10, paddingTop:10, borderTop:'1px dashed #fecdd3'}}>
            {weekConflictsList.map((item, idx) => (
              <div 
                key={idx} 
                style={{
                  background: '#fff', 
                  border: '1px solid #fecdd3', 
                  borderRadius: 10, 
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8
                }}
              >
                <div>
                  <div style={{fontSize:13, color:'#881337'}}>
                    <b>{item.dayName} ({item.dateStr}):</b> <b>{item.student1}</b> এবং <b>{item.student2}</b> দুজনের ক্লাস ওভারল্যাপ হয়েছে!
                  </div>
                  <div style={{fontSize:11, color:'#e11d48', marginTop:2}}>
                    সময়: {item.student1} [{item.time1}] ↔ {item.student2} [{item.time2}]
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayIdx(item.dayIndex)
                    setViewMode('agenda')
                  }}
                  style={{
                    background: '#be123c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🔍 এই দিনে গিয়ে সমাধান করুন
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* Unscheduled Students Alert Banner (Collapsible for Clean Mobile View) */}
    {unscheduledStudents.length > 0 && (
      <div style={{
        background:'#fff7ed',
        border:'1px solid #fdba74',
        borderRadius:14,
        padding:'10px 14px',
        marginBottom:14
      }}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8}}>
          <div style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#9a3412'}}>
            <UserX size={18} style={{color:'#ea580c', flexShrink:0}}/>
            <span><b>{unscheduledStudents.length} Students</b> have no weekly schedule set yet</span>
          </div>
          <button
            type="button"
            onClick={() => setUnscheduledExpanded(!unscheduledExpanded)}
            style={{
              background: '#fff',
              border: '1px solid #fdba74',
              color: '#ea580c',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {unscheduledExpanded ? 'Hide ▲' : 'View Students ▼'}
          </button>
        </div>

        {unscheduledExpanded && (
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:10, paddingTop:10, borderTop:'1px dashed #fed7aa'}}>
            {unscheduledStudents.map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => openAddModal(undefined, undefined, st.id)}
                style={{
                  background:'#fff',
                  border:'1px solid #ea580c',
                  color:'#c2410c',
                  borderRadius:999,
                  padding:'5px 12px',
                  fontSize:12,
                  fontWeight:700,
                  cursor:'pointer',
                  display:'flex',
                  alignItems:'center',
                  gap:5,
                  boxShadow:'0 1px 3px rgba(234, 88, 12, 0.1)'
                }}
              >
                ⚡ Set Schedule: <b>{st.name}</b>
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    
    {/* Navigation & View Mode Toolbar */}
    <div className="toolbar" style={{justifyContent:'space-between', gap:10}}>
      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        <div className="week-nav">
          <button className="btn btn-ghost" onClick={()=>setWeek(subWeeks(week,1))}><ChevronLeft size={16}/></button>
          <b style={{fontSize:13}}>{format(dates[0],'d MMM')} – {format(dates[6],'d MMM')}</b>
          <button className="btn btn-ghost" onClick={()=>setWeek(addWeeks(week,1))}><ChevronRight size={16}/></button>
        </div>

        {/* View Switcher: Day Agenda (Best on Mobile) vs Full Grid */}
        <div style={{display:'inline-flex', background:'#e2e8f0', padding:3, borderRadius:10}}>
          <button
            type="button"
            onClick={()=>setViewMode('agenda')}
            style={{
              border:'none',
              background:viewMode==='agenda'?'#fff':'transparent',
              color:viewMode==='agenda'?'#0f172a':'#64748b',
              fontWeight:700,
              padding:'6px 12px',
              borderRadius:8,
              fontSize:12,
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
              gap:5,
              boxShadow:viewMode==='agenda'?'0 1px 3px rgba(0,0,0,0.1)':'none'
            }}
          >
            📋 Day Agenda
          </button>
          <button
            type="button"
            onClick={()=>setViewMode('grid')}
            style={{
              border:'none',
              background:viewMode==='grid'?'#fff':'transparent',
              color:viewMode==='grid'?'#0f172a':'#64748b',
              fontWeight:700,
              padding:'6px 12px',
              borderRadius:8,
              fontSize:12,
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
              gap:5,
              boxShadow:viewMode==='grid'?'0 1px 3px rgba(0,0,0,0.1)':'none'
            }}
          >
            📅 Full Table
          </button>
        </div>
      </div>

      <div style={{display:'flex', alignItems:'center', gap:8, flex:1, minWidth:200, justifyContent:'flex-end'}}>
        <input 
          className="input" 
          style={{maxWidth:240, padding:'7px 10px', fontSize:13}} 
          placeholder="Search student…" 
          value={query} 
          onChange={e=>setQuery(e.target.value)}
        />
        {selected&&<span className="badge red" style={{cursor:'pointer'}} onClick={()=>setSelected(null)}>✕ {studentName(selected.student_id)}</span>}
      </div>
    </div>

    {/* =========================================================================
        MODE 1: DAY AGENDA VIEW (ULTRA-CLEAN, MOBILE-FIRST, ZERO HORIZONTAL CLUTTER)
       ========================================================================= */}
    {viewMode === 'agenda' && (
      <div>
        {/* Horizontal Day Selector Pills */}
        <div className="mobile-day-pills">
          {dates.map((d, di) => {
            const isSelected = selectedDayIdx === di
            const isCurrToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            const count = classCountByDay[di] || 0
            return (
              <button
                key={di}
                type="button"
                className={`mobile-day-pill ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedDayIdx(di)}
              >
                <div style={{fontSize:11, fontWeight:700, opacity:isSelected?1:0.7, textTransform:'uppercase'}}>
                  {DAYS[di].slice(0,3)}
                </div>
                <div style={{fontSize:18, fontWeight:800, margin:'2px 0'}}>
                  {format(d, 'd')}
                </div>
                <div style={{
                  fontSize:10, 
                  fontWeight:700, 
                  borderRadius:999, 
                  padding:'1px 6px',
                  background: isSelected ? 'rgba(255,255,255,0.25)' : (count > 0 ? '#e0e7ff' : '#f1f5f9'),
                  color: isSelected ? '#fff' : (count > 0 ? '#4338ca' : '#94a3b8'),
                  display:'inline-block'
                }}>
                  {count > 0 ? `${count} class${count > 1 ? 'es' : ''}` : 'Off'}
                </div>
                {isCurrToday && (
                  <div style={{fontSize:9, fontWeight:800, color:isSelected?'#fff':'#4f46e5', marginTop:2}}>
                    ● TODAY
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Selected Day Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', margin:'16px 0 12px', flexWrap:'wrap', gap:8}}>
          <div>
            <h2 style={{fontSize:18, fontWeight:800, margin:0, color:'#0f172a'}}>
              {format(dates[selectedDayIdx], 'EEEE, d MMMM')}
            </h2>
            <div className="sub" style={{fontSize:12}}>
              {agendaDayClasses.length === 0 ? 'No classes scheduled for today' : `${agendaDayClasses.length} tutoring class${agendaDayClasses.length > 1 ? 'es' : ''} scheduled`}
            </div>
          </div>

          <button 
            className="btn btn-soft" 
            style={{padding:'7px 12px', fontSize:12, fontWeight:700}}
            onClick={() => openAddModal(selectedDayIdx)}
          >
            <Plus size={14}/> Add Class for {DAYS[selectedDayIdx]}
          </button>
        </div>

        {/* Classes List */}
        {agendaDayClasses.length === 0 ? (
          <div className="card" style={{textAlign:'center', padding:'40px 20px', background:'#fff'}}>
            <div style={{fontSize:32, marginBottom:10}}>🎉</div>
            <b style={{fontSize:16, display:'block', color:'#0f172a'}}>No Classes on {DAYS[selectedDayIdx]}</b>
            <p style={{fontSize:13, color:'#64748b', maxWidth:360, margin:'6px auto 16px'}}>
              You have no scheduled sessions on this day. Take a break or add a student session.
            </p>
            <button className="btn btn-primary" onClick={() => openAddModal(selectedDayIdx)}>
              <Plus size={15}/> Schedule a Class
            </button>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            {agendaDayClasses.map((c: any) => {
              const conflicts = getDayConflicts(c)
              const freeSlots = conflicts.length > 0 ? getAvailableFreeSlots(c, 3) : []
              const studentColor = c.student?.color || '#4f46e5'
              const startM = minutesFromTime(c.start_time)
              const endM = startM + Number(c.duration_minutes || 60)
              const endTimeStr = timeFromMinutes(endM)
              const isSelected = selected?.id === c.id

              return (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    borderLeft: `5px solid ${studentColor}`,
                    background: '#fff',
                    boxShadow: isSelected ? '0 0 0 2px #4f46e5, var(--shadow)' : 'var(--shadow)',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10}}>
                    {/* Student Info */}
                    <div style={{display:'flex', alignItems:'center', gap:12}}>
                      <div style={{
                        width:42, height:42, borderRadius:12,
                        background: studentColor, color:'#fff',
                        display:'grid', placeItems:'center',
                        fontWeight:800, fontSize:16, flexShrink:0
                      }}>
                        {studentName(c.student_id).charAt(0)}
                      </div>
                      <div>
                        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                          <b style={{fontSize:16, color:'#0f172a'}}>{studentName(c.student_id)}</b>
                          {c.is_exception && <span className="badge" style={{background:'#fef3c7', color:'#92400e', fontSize:10}}>Rescheduled / Extra</span>}
                          {c.exception?.status === 'completed' && <span className="badge green" style={{fontSize:10}}>✓ Present</span>}
                          {c.exception?.status === 'absent' && <span className="badge red" style={{fontSize:10}}>✕ Absent</span>}
                          {c.exception?.status === 'off' && <span className="badge" style={{background:'#f1f5f9', color:'#64748b', fontSize:10}}>⏸️ Off</span>}
                        </div>
                        <div style={{fontSize:12, color:'#64748b', marginTop:2}}>
                          {c.student?.subject || 'Tutoring'} • {c.student?.phone || 'No phone'}
                        </div>
                      </div>
                    </div>

                    {/* Time Pill */}
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1e293b'
                    }}>
                      <Clock size={14} color="#6366f1"/>
                      <span>{prettyTime(c.start_time)} – {prettyTime(endTimeStr)}</span>
                      <span style={{fontSize:11, color:'#64748b', fontWeight:500}}>({c.duration_minutes}m)</span>
                    </div>
                  </div>

                  {/* Detailed Conflict Alert Banner */}
                  {conflicts.length > 0 && (
                    <div style={{
                      marginTop: 12,
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: 12,
                      padding: '12px 14px',
                      color: '#881337'
                    }}>
                      <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                        <AlertTriangle size={18} style={{color:'#e11d48', flexShrink:0, marginTop:1}}/>
                        <div style={{flex:1}}>
                          <b style={{fontSize:13, color:'#9f1239'}}>
                            ⚠️ টাইমিং কনফ্লিক্ট! (Time Conflict Detected)
                          </b>
                          <div style={{fontSize:12, marginTop:4, color:'#4c0519', lineHeight:1.5}}>
                            কার কার সাথে সময় মিলে গেছে:
                            <div style={{display:'flex', flexDirection:'column', gap:4, marginTop:4}}>
                              {conflicts.map(other => {
                                const oStart = minutesFromTime(other.start_time)
                                const oEnd = oStart + Number(other.duration_minutes || 60)
                                return (
                                  <div key={other.id} style={{padding:'4px 8px', background:'rgba(255,255,255,0.85)', borderRadius:6, border:'1px solid #fecdd3', display:'inline-block'}}>
                                    👉 <b>{studentName(other.student_id)}</b> ({prettyTime(other.start_time)} – {prettyTime(timeFromMinutes(oEnd))}, {other.duration_minutes}m)
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Actionable Ways to Solve the Conflict */}
                          <div style={{marginTop:10, paddingTop:8, borderTop:'1px dashed #fecdd3'}}>
                            <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', color:'#be123c', marginBottom:6}}>
                              💡 সমাধান করার উপায় (Quick Fix Solutions):
                            </div>

                            <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
                              {freeSlots.length > 0 && (
                                <div style={{display:'flex', alignItems:'center', gap:5, flexWrap:'wrap'}}>
                                  <span style={{fontSize:11, fontWeight:600, color:'#4c0519'}}>খালি স্লটে সরান:</span>
                                  {freeSlots.map(slot => (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={async () => {
                                        await quickMoveToSlot(c, slot, true)
                                      }}
                                      style={{
                                        background: '#fff',
                                        border: '1px solid #be123c',
                                        color: '#be123c',
                                        borderRadius: 6,
                                        padding: '4px 10px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                      title={`Move ${studentName(c.student_id)} to ${prettyTime(slot)}`}
                                    >
                                      ⚡ {prettyTime(slot)} এ দিন
                                    </button>
                                  ))}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setSelected({ ...c, date: selectedDateStr })
                                  openMove('temporary')
                                }}
                                style={{
                                  background: '#be123c',
                                  border: 'none',
                                  color: '#fff',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                ✏️ ১ দিনের সময় পরিবর্তন
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelected({ ...c, date: selectedDateStr })
                                  openMove('permanent')
                                }}
                                style={{
                                  background: '#fff',
                                  border: '1px solid #be123c',
                                  color: '#be123c',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                🔄 স্থায়ী রুটিন পরিবর্তন
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons Directly on Card */}
                  <div style={{display:'flex', gap:8, marginTop:14, paddingTop:12, borderTop:'1px solid #f1f5f9', flexWrap:'wrap', alignItems:'center'}}>
                    <button
                      type="button"
                      className="btn btn-soft"
                      style={{padding:'7px 12px', fontSize:12, fontWeight:700}}
                      onClick={() => {
                        setSelected({ ...c, date: selectedDateStr })
                        openMove('temporary')
                      }}
                      title="Change time for this specific day"
                    >
                      <Clock size={13}/> ১ দিনের টাইম চেঞ্জ
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{padding:'7px 12px', fontSize:12, fontWeight:700, color:'#4338ca'}}
                      onClick={() => {
                        setSelected({ ...c, date: selectedDateStr })
                        openMove('permanent')
                      }}
                      title="Permanently update weekly routine"
                    >
                      <RefreshCw size={13}/> স্থায়ী রুটিন চেঞ্জ
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{padding:'7px 10px', fontSize:12, color:'#64748b'}}
                      onClick={async () => {
                        await saveException({
                          schedule_id: c.id,
                          student_id: c.student_id,
                          class_date: selectedDateStr,
                          start_time: c.start_time.slice(0,5),
                          duration_minutes: c.duration_minutes,
                          status: 'off'
                        })
                      }}
                    >
                      ⏸️ আজকের ক্লাস অফ
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{
                        padding:'7px 12px',
                        fontSize:12,
                        color:'#dc2626',
                        border:'1px solid #fecaca',
                        background:'#fff5f5',
                        marginLeft:'auto'
                      }}
                      onClick={async () => {
                        const sName = studentName(c.student_id)
                        if (c.is_exception) {
                          if (confirm(`Remove this extra/rescheduled class for ${sName}?`)) {
                            await deleteException(c.id)
                          }
                        } else {
                          if (confirm(`Are you sure you want to permanently delete ${sName}'s weekly schedule on ${DAYS[selectedDayIdx]}?`)) {
                            await deleteSchedule(c.id)
                            if (c.exception?.id) {
                              await deleteException(c.exception.id)
                            }
                          }
                        }
                      }}
                      title="Delete this schedule"
                    >
                      <Trash2 size={13}/> ডিলিট
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )}

    {/* =========================================================================
        MODE 2: FULL 7-DAY DESKTOP GRID (SCROLLABLE TABLE VIEW)
       ========================================================================= */}
    {viewMode === 'grid' && (
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
    )}

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

    {/* Add weekly class modal with SMART FREE SLOTS & UNSCHEDULED DETECTOR */}
    {modal&&(
      <Modal title="Add weekly schedule" onClose={()=>setModal(false)}>
        <form onSubmit={handleAddClasses} className="form-grid">
          
          {/* Quick Unscheduled Student Chips inside Modal */}
          {unscheduledStudents.length > 0 && (
            <div style={{gridColumn:'1/-1',background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10,padding:'8px 12px'}}>
              <span style={{fontSize:11,fontWeight:700,color:'#c2410c',display:'block',marginBottom:4}}>
                ⚡ শিডিউল বাকি থাকা স্টুডেন্ট (ক্লিক করে সিলেক্ট করুন):
              </span>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {unscheduledStudents.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStudentId(st.id)}
                    style={{
                      background: selectedStudentId === st.id ? '#ea580c' : '#fff',
                      color: selectedStudentId === st.id ? '#fff' : '#9a3412',
                      border: '1px solid #ea580c',
                      borderRadius: 999,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {st.name} {selectedStudentId === st.id ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field" style={{gridColumn:'1/-1'}}>
            <label>Student</label>
            <select 
              className="select" 
              value={selectedStudentId} 
              onChange={e=>setSelectedStudentId(e.target.value)}
              required
            >
              {activeStudents.map(s=>{
                const studentScheds = schedules.filter(sc => sc.student_id === s.id && sc.active !== false)
                const isUnscheduled = studentScheds.length === 0
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} {isUnscheduled ? '— ⚠️ No schedule set (শিডিউল বাকি)' : `(✓ ${studentScheds.length} days: ${studentScheds.map(sc=>DAYS[sc.day_of_week].slice(0,3)).join(',')})`}
                  </option>
                )
              })}
            </select>
            {isSelectedStudentUnscheduled && (
              <div style={{fontSize:12,color:'#ea580c',marginTop:4,fontWeight:600}}>
                ⚠️ <b>{studentName(selectedStudentId)}</b> এর এখনো কোনো রুটিন সেট করা হয়নি। নিচে দিন ও ফাঁকা সময় বেছে নিন।
              </div>
            )}
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
          {currentStudentSchedules.length > 0 ? (
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
          ) : (
            <div style={{gridColumn:'1/-1',background:'#fffbeb',border:'1px dashed #f59e0b',borderRadius:10,padding:10,fontSize:12,color:'#b45309',textAlign:'center'}}>
              ℹ️ <b>{studentName(selectedStudentId)}</b> এর কোনো আগের রুটিন নেই। দিন এবং সময় সিলেক্ট করে সেভ করুন।
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

'use client'
import {useMemo,useState} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import {useData} from '@/components/DataProvider'
import {DAYS,prettyTime,minutesFromTime,timeFromMinutes} from '@/lib/utils'
import {addDays,format,startOfWeek,subWeeks,addWeeks} from 'date-fns'
import {ChevronLeft,ChevronRight,Plus} from 'lucide-react'

function CalendarPage(){
 const {students,schedules,exceptions,settings,saveSchedule,saveException}=useData()
 const [week,setWeek]=useState(new Date())
 const [modal,setModal]=useState(false)
 const [selected,setSelected]=useState<any>(null)
 const [query,setQuery]=useState('')
 const [moveModal,setMoveModal]=useState(false)
 const [moveDate,setMoveDate]=useState('')
 const [moveTime,setMoveTime]=useState('')

 const sat=addDays(startOfWeek(week,{weekStartsOn:0}),-1)
 const dates=Array.from({length:7},(_,i)=>addDays(sat,i))

 // Only show time slots that have at least one class
 const slots=useMemo(()=>{
  if(!schedules.length){
   const a:string[]=[]
   for(let m=minutesFromTime(settings.day_start);m<minutesFromTime(settings.day_end);m+=settings.interval_minutes)
    a.push(timeFromMinutes(m))
   return a
  }
  const used=new Set<string>()
  schedules.forEach(s=>{
   const start=minutesFromTime(s.start_time)
   const end=start+s.duration_minutes
   const interval=settings.interval_minutes||30
   for(let m=start;m<end;m+=interval)used.add(timeFromMinutes(m))
  })
  return Array.from(used).sort()
 },[settings,schedules])

 function studentName(id:string){return students.find(s=>s.id===id)?.name||'Student'}
 function exFor(student_id:string,date:string,start:string){
  return exceptions.find(e=>e.student_id===student_id&&e.class_date===date&&e.start_time.slice(0,5)===start.slice(0,5))
 }
 function eventsFor(day:number,slot:string,date:string){
  return schedules
   .filter(s=>s.day_of_week===day&&s.start_time.slice(0,5)===slot&&studentName(s.student_id).toLowerCase().includes(query.toLowerCase()))
   .filter(s=>{const ex=exFor(s.student_id,date,slot);return !ex||!['off','cancelled','rescheduled','missed'].includes(ex.status)})
   .map(s=>({...s,date}))
 }
 function overlap(day:number,slot:string){
  return schedules.filter(s=>s.day_of_week===day&&s.start_time.slice(0,5)===slot).length>1
 }
 async function addClass(fd:FormData){
  const student_id=String(fd.get('student_id'))
  const day=Number(fd.get('day'))
  const start_time=String(fd.get('start_time'))
  const duration_minutes=Number(fd.get('duration'))
  await saveSchedule({student_id,day_of_week:day,start_time,duration_minutes})
  setModal(false)
 }
 async function doMove(){
  if(!selected||!moveDate||!moveTime)return
  await saveException({schedule_id:selected.id,student_id:selected.student_id,class_date:selected.date,start_time:selected.start_time.slice(0,5),duration_minutes:selected.duration_minutes,status:'rescheduled',original_date:selected.date})
  await saveException({student_id:selected.student_id,class_date:moveDate,start_time:moveTime,duration_minutes:selected.duration_minutes,status:'scheduled',original_date:selected.date})
  setSelected(null)
  setMoveModal(false)
 }
 function openMove(){
  if(!selected)return
  setMoveDate(selected.date)
  setMoveTime(selected.start_time.slice(0,5))
  setMoveModal(true)
 }

 return <>
  <Topbar title="Weekly Calendar" subtitle="Click a class to select · then use Move to reschedule" actions={<button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={16}/> Add class</button>}/>
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
         {ev.map(e=>(
          <div key={e.id} className={'event '+(overlap(di,slot)?'conflict':'')} style={{background:e.student?.color||students.find(s=>s.id===e.student_id)?.color||'#4f46e5',outline:selected?.id===e.id?'2px solid #fff':undefined,opacity:selected&&selected.id!==e.id?0.6:1}} onClick={x=>{x.stopPropagation();setSelected(selected?.id===e.id?null:{...e,date:format(dates[di],'yyyy-MM-dd')})}}>
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
   <div className="card" style={{position:'fixed',right:20,bottom:20,zIndex:30,maxWidth:320}}>
    <b>{studentName(selected.student_id)}</b>
    <div className="sub">{selected.date} · {prettyTime(selected.start_time)} · {selected.duration_minutes}m</div>
    <div className="toolbar" style={{margin:'12px 0 0'}}>
     <button className="btn btn-primary" onClick={openMove}>Move to…</button>
     <button className="btn btn-ghost" onClick={async()=>{await saveException({schedule_id:selected.id,student_id:selected.student_id,class_date:selected.date,start_time:selected.start_time.slice(0,5),duration_minutes:selected.duration_minutes,status:'off'});setSelected(null)}}>Off today</button>
     <button className="btn btn-ghost" onClick={()=>setSelected(null)}>Close</button>
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

  {/* Add class modal */}
  {modal&&(
   <Modal title="Add weekly class" onClose={()=>setModal(false)}>
    <form action={addClass} className="form-grid">
     <div className="field"><label>Student</label><select className="select" name="student_id" required>{students.filter(s=>!s.archived).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
     <div className="field"><label>Day</label><select className="select" name="day">{DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></div>
     <div className="field"><label>Start time</label><input className="input" name="start_time" type="time" defaultValue="07:00"/></div>
     <div className="field"><label>Duration (minutes)</label><input className="input" name="duration" type="number" defaultValue={settings.default_duration_minutes} min="15" step="15"/></div>
     <div style={{gridColumn:'1/-1'}}><button className="btn btn-primary" type="submit">Save class</button></div>
    </form>
   </Modal>
  )}
 </>
}
export default function Page(){return <ProtectedLayout><CalendarPage/></ProtectedLayout>}

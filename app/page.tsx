'use client'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import { useData } from '@/components/DataProvider'
import { currency, DAYS, prettyTime } from '@/lib/utils'
import { format } from 'date-fns'

function Dashboard(){
 const {students,schedules,tasks,payments,exceptions,saveException}=useData()
 const active=students.filter(s=>!s.archived)
 const todayJs=new Date().getDay(); const todayIndex=Object.entries({0:6,1:0,2:1,3:2,4:3,5:4,6:5}).find(([,js])=>js===todayJs)?.[0]
 const todays=schedules.filter(s=>String(s.day_of_week)===todayIndex).sort((a,b)=>a.start_time.localeCompare(b.start_time))
 const pending=tasks.filter(t=>t.status!=='done')
 const todayKey=format(new Date(),'yyyy-MM-dd')
 const nowMinutes=new Date().getHours()*60+new Date().getMinutes()
 const attendanceDue=todays.filter(s=>{const [h,m]=s.start_time.slice(0,5).split(':').map(Number);return h*60+m+s.duration_minutes<=nowMinutes && !exceptions.some(e=>e.student_id===s.student_id&&e.class_date===todayKey&&['completed','absent','cancelled','missed','rescheduled'].includes(e.status))})
 const month=format(new Date(),'yyyy-MM'); const received=payments.filter(p=>p.month_key===month).reduce((a,p)=>a+Number(p.amount),0)
 const due=active.reduce((a,s)=>a+Number(s.monthly_fee||0),0)-received
 return <>
  <Topbar title="Dashboard" subtitle={`${format(new Date(),'EEEE, d MMMM yyyy')} · Your tutoring command center`} />
  <div className="grid grid-4">
   <div className="card"><div className="stat-label">Active students</div><div className="stat-value">{active.length}</div></div>
   <div className="card"><div className="stat-label">Today's classes</div><div className="stat-value">{todays.length}</div></div>
   <div className="card"><div className="stat-label">Pending tasks</div><div className="stat-value">{pending.length}</div></div>
   <div className="card"><div className="stat-label">Monthly due</div><div className="stat-value">{currency(Math.max(0,due))}</div></div>
  </div>
  <div className="grid grid-2" style={{marginTop:16}}>
   <div className="card"><h3 className="section-title">Today's schedule</h3><div className="list">{todays.length?todays.map(s=><div className="list-item" key={s.id}><div><b>{s.student?.name||students.find(x=>x.id===s.student_id)?.name}</b><div className="sub">{prettyTime(s.start_time)} · {s.duration_minutes} min</div></div><span className="badge">{DAYS[s.day_of_week]}</span></div>):<div className="empty">No class scheduled today.</div>}</div></div>
   <div className="card"><h3 className="section-title">Tasks</h3><div className="list">{pending.slice(0,6).map(t=><div className="list-item" key={t.id}><div><b>{t.title}</b><div className="sub">{t.priority} priority</div></div><span className={'badge '+(t.priority==='high'?'red':'')}>{t.status.replace('_',' ')}</span></div>)}</div></div>
  </div>
  <div className="card" style={{marginTop:16}}><h3 className="section-title">Attendance check</h3>{attendanceDue.length?attendanceDue.map(s=><div className="list-item" key={s.id}><div><b>{s.student?.name||students.find(x=>x.id===s.student_id)?.name}</b><div className="sub">Class ended · mark what happened</div></div><div className="toolbar" style={{margin:0}}>{['completed','absent','cancelled','missed'].map(st=><button key={st} className="btn btn-ghost" onClick={()=>saveException({schedule_id:s.id,student_id:s.student_id,class_date:todayKey,start_time:s.start_time.slice(0,5),duration_minutes:s.duration_minutes,status:st as any})}>{st}</button>)}</div></div>):<div className="empty">No attendance action needed right now.</div>}</div>
 </>
}
export default function Page(){return <ProtectedLayout><Dashboard/></ProtectedLayout>}

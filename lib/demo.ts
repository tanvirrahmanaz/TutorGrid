import { Student, Schedule, TaskItem } from './types'

export const demoStudents: Student[] = [
  { id:'a0000000-0000-4000-8000-000000000001', name:'Arman', subject:'Math & Physics', color:'#4f46e5', archived:false },
  { id:'a0000000-0000-4000-8000-000000000002', name:'Mridila', subject:'English', color:'#0891b2', archived:false },
  { id:'a0000000-0000-4000-8000-000000000003', name:'Erina', subject:'Chemistry', color:'#059669', archived:false },
  { id:'a0000000-0000-4000-8000-000000000004', name:'Sathi', subject:'Biology', color:'#db2777', archived:false },
  { id:'a0000000-0000-4000-8000-000000000005', name:'Zihad', subject:'Higher Math', color:'#ea580c', archived:false },
  { id:'a0000000-0000-4000-8000-000000000006', name:'Siyam', subject:'Physics', color:'#7c3aed', archived:false },
  { id:'a0000000-0000-4000-8000-000000000007', name:'Raza', subject:'ICT', color:'#ca8a04', archived:false },
  { id:'a0000000-0000-4000-8000-000000000008', name:'Nayeem', subject:'General Science', color:'#0f766e', archived:false },
  { id:'a0000000-0000-4000-8000-000000000009', name:'Rudro', subject:'Math', color:'#2563eb', archived:false },
  { id:'a0000000-0000-4000-8000-000000000010', name:'Shafin', subject:'Accounting', color:'#9333ea', archived:false },
  { id:'a0000000-0000-4000-8000-000000000011', name:'Sharafat', subject:'Finance', color:'#be123c', archived:false },
  { id:'a0000000-0000-4000-8000-000000000012', name:'Tasin', subject:'Economics', color:'#65a30d', archived:false }
]

const mk=(student_id:string,days:number[],start_time:string,duration_minutes=60):Schedule[]=>days.map((d,i)=>({
  id: `b0000000-0000-4000-8000-${student_id.slice(-8)}${i.toString().padStart(4, '0')}`,
  student_id,
  day_of_week:d,
  start_time,
  duration_minutes,
  recurrence:'weekly',
  active:true,
  student:demoStudents.find(s=>s.id===student_id)
}))

export const demoSchedules: Schedule[] = [
  ...mk('a0000000-0000-4000-8000-000000000001',[1,3,5],'10:30',60),
  ...mk('a0000000-0000-4000-8000-000000000002',[0,2,4],'14:00',90),
  ...mk('a0000000-0000-4000-8000-000000000003',[0,2,4],'17:00',90),
  ...mk('a0000000-0000-4000-8000-000000000005',[0,2,4],'15:00',60),
  ...mk('a0000000-0000-4000-8000-000000000006',[6,0,4],'08:00',60),
  ...mk('a0000000-0000-4000-8000-000000000007',[1,3,5],'18:00',60),
  ...mk('a0000000-0000-4000-8000-000000000008',[0,2,4],'07:00',60),
  ...mk('a0000000-0000-4000-8000-000000000009',[1,3,5],'19:00',60),
]

export const demoTasks: TaskItem[] = [
  { id:'d0000000-0000-4000-8000-000000000001', title:'Update Arman lesson plan', student_id:'a0000000-0000-4000-8000-000000000001', priority:'high', status:'todo' },
  { id:'d0000000-0000-4000-8000-000000000002', title:'Check monthly payments', priority:'medium', status:'in_progress' }
]


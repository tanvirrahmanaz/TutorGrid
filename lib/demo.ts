import { Student, Schedule, TaskItem } from './types'

export const demoStudents: Student[] = [
  { id:'arman', name:'Arman', subject:'', color:'#4f46e5', archived:false },
  { id:'mridila', name:'Mridila', subject:'', color:'#0891b2', archived:false },
  { id:'erina', name:'Erina', subject:'', color:'#059669', archived:false },
  { id:'sathi', name:'Sathi', subject:'', color:'#db2777', archived:false },
  { id:'zihad', name:'Zihad', subject:'', color:'#ea580c', archived:false },
  { id:'siyam', name:'Siyam', subject:'', color:'#7c3aed', archived:false },
  { id:'raza', name:'Raza', subject:'', color:'#ca8a04', archived:false },
  { id:'nayeem', name:'Nayeem', subject:'', color:'#0f766e', archived:false },
  { id:'rudro', name:'Rudro', subject:'', color:'#2563eb', archived:false },
  { id:'shafin', name:'Shafin', subject:'', color:'#9333ea', archived:false },
  { id:'sharafat', name:'Sharafat', subject:'', color:'#be123c', archived:false },
  { id:'tasin', name:'Tasin', subject:'', color:'#65a30d', archived:false }
]

const mk=(id:string,student_id:string,days:number[],start_time:string,duration_minutes=60):Schedule[]=>days.map((d,i)=>({id:`${id}-${i}`,student_id,day_of_week:d,start_time,duration_minutes,recurrence:'weekly',active:true,student:demoStudents.find(s=>s.id===student_id)}))

export const demoSchedules: Schedule[] = [
  ...mk('arman','arman',[1,3,5],'10:30',60),
  ...mk('mridila','mridila',[0,2,4],'14:00',90),
  ...mk('erina','erina',[0,2,4],'17:00',90),
  ...mk('zihad','zihad',[0,2,4],'15:00',60),
  ...mk('siyam','siyam',[6,0,4],'08:00',60),
  ...mk('raza','raza',[1,3,5],'18:00',60),
  ...mk('nayeem','nayeem',[0,2,4],'07:00',60),
  ...mk('rudro','rudro',[1,3,5],'19:00',60),
]

export const demoTasks: TaskItem[] = [
  { id:'1', title:'Update Arman lesson plan', student_id:'arman', priority:'high', status:'todo' },
  { id:'2', title:'Check monthly payments', priority:'medium', status:'in_progress' }
]

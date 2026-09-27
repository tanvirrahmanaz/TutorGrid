'use client'
import React,{createContext,useContext,useEffect,useMemo,useState} from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { demoSchedules,demoStudents,demoTasks } from '@/lib/demo'
import type {Payment,Schedule,ScheduleException,Settings,Student,TaskItem} from '@/lib/types'

type Ctx={
  students:Student[];
  schedules:Schedule[];
  exceptions:ScheduleException[];
  tasks:TaskItem[];
  payments:Payment[];
  settings:Settings;
  reload:()=>Promise<void>;
  saveStudent:(x:Partial<Student>)=>Promise<void>;
  archiveStudent:(id:string)=>Promise<void>;
  saveSchedule:(x:Partial<Schedule>&{student_id:string})=>Promise<void>;
  saveSchedulesBulk:(items:Array<{student_id:string;day_of_week:number;start_time:string;duration_minutes:number}>)=>Promise<void>;
  deleteSchedule:(id:string)=>Promise<void>;
  saveException:(x:Partial<ScheduleException>&{student_id:string;class_date:string;start_time:string;duration_minutes:number;status:ScheduleException['status']})=>Promise<void>;
  deleteException:(id:string)=>Promise<void>;
  saveTask:(x:Partial<TaskItem>&{title:string})=>Promise<void>;
  savePayment:(x:Partial<Payment>&{student_id:string;month_key:string;amount:number})=>Promise<void>;
  saveSettings:(x:Partial<Settings>)=>Promise<void>;
}
const defaults:Settings={id:'default',day_start:'07:00',day_end:'22:00',interval_minutes:30,default_duration_minutes:60,reminder_minutes:30}
const C=createContext<Ctx|null>(null)
const LS='tutorgrid_demo_v1'

function uid(){return crypto.randomUUID()}

export function DataProvider({children}:{children:React.ReactNode}){
  const [students,setStudents]=useState<Student[]>([])
  const [schedules,setSchedules]=useState<Schedule[]>([])
  const [exceptions,setExceptions]=useState<ScheduleException[]>([])
  const [tasks,setTasks]=useState<TaskItem[]>([])
  const [payments,setPayments]=useState<Payment[]>([])
  const [settings,setSettings]=useState<Settings>(defaults)

  const supabase=getSupabaseBrowser()

  function loadLocal(){
    const raw=localStorage.getItem(LS)
    if(raw){
      const d=JSON.parse(raw)
      setStudents(d.students||[])
      setSchedules(d.schedules||[])
      setExceptions(d.exceptions||[])
      setTasks(d.tasks||[])
      setPayments(d.payments||[])
      setSettings(d.settings||defaults)
    }else{
      setStudents(demoStudents)
      setSchedules(demoSchedules)
      setTasks(demoTasks)
      persist({students:demoStudents,schedules:demoSchedules,exceptions:[],tasks:demoTasks,payments:[],settings:defaults})
    }
  }

  function persist(o:any){
    try {
      localStorage.setItem(LS,JSON.stringify(o))
    } catch (e) {
      console.error(e)
    }
  }

  function localSnapshot(overrides:any={}){
    return{students,schedules,exceptions,tasks,payments,settings,...overrides}
  }

  async function reload(){
    if(!supabase){
      loadLocal()
      return
    }
    try {
      const [a,b,c,d,e,f]=await Promise.all([
        supabase.from('students').select('*').order('name'),
        supabase.from('schedules').select('*,student:students(*)').eq('active',true),
        supabase.from('schedule_exceptions').select('*,student:students(*)'),
        supabase.from('tasks').select('*').order('due_at',{ascending:true}),
        supabase.from('payments').select('*,student:students(*)').order('paid_at',{ascending:false}),
        supabase.from('app_settings').select('*').limit(1).maybeSingle()
      ])
      if(a.error){
        loadLocal()
        return
      }
      setStudents(a.data||[])
      setSchedules((b.data||[]) as any)
      setExceptions((c.data||[]) as any)
      setTasks((d.data||[]) as any)
      setPayments((e.data||[]) as any)
      if(f.data) setSettings(f.data as any)
    } catch(err) {
      console.error('Error reloading from Supabase:', err)
      loadLocal()
    }
  }

  useEffect(()=>{reload()},[])

  async function saveStudent(x:Partial<Student>){
    const newStudent = {
      id: x.id || uid(),
      name: x.name || 'Student',
      subject: x.subject || '',
      color: x.color || '#4f46e5',
      phone: x.phone || null,
      notes: x.notes || '',
      monthly_fee: Number(x.monthly_fee || 0),
      archived: x.archived || false
    } as Student

    setStudents(prev => {
      const next = x.id ? prev.map(s => s.id === x.id ? { ...s, ...newStudent } : s) : [...prev, newStudent]
      persist(localSnapshot({students:next}))
      return next
    })

    if(supabase){
      try {
        const row = {
          name: newStudent.name,
          subject: newStudent.subject,
          color: newStudent.color,
          phone: newStudent.phone,
          notes: newStudent.notes,
          monthly_fee: newStudent.monthly_fee,
          archived: newStudent.archived
        }
        if(x.id) await supabase.from('students').update(row).eq('id',x.id)
        else await supabase.from('students').insert(row)
        await reload()
      } catch(err) {
        console.error('saveStudent error:', err)
      }
    }
  }

  async function archiveStudent(id:string){
    setStudents(prev => {
      const next = prev.map(s => s.id === id ? { ...s, archived: true } : s)
      persist(localSnapshot({students:next}))
      return next
    })
    if(supabase){
      try {
        await supabase.from('students').update({archived:true}).eq('id',id)
        await reload()
      } catch(err) {
        console.error('archiveStudent error:', err)
      }
    }
  }

  async function saveSchedule(x:Partial<Schedule>&{student_id:string}){
    const student = students.find(s => s.id === x.student_id)
    const cleanTime = (x.start_time || '07:00').slice(0,5)
    const row = {
      student_id: x.student_id,
      day_of_week: Number(x.day_of_week ?? 0),
      start_time: cleanTime,
      duration_minutes: Number(x.duration_minutes || settings.default_duration_minutes || 60),
      recurrence: 'weekly' as const,
      active: true
    }
    const newSchedule = { id: x.id || uid(), ...row, student } as Schedule

    setSchedules(prev => {
      const next = x.id 
        ? prev.map(s => s.id === x.id ? { ...s, ...row, student } as Schedule : s)
        : [...prev.filter(s => !(s.student_id === x.student_id && Number(s.day_of_week) === Number(row.day_of_week) && s.start_time.slice(0,5) === cleanTime)), newSchedule]
      persist(localSnapshot({ schedules: next }))
      return next
    })

    if(supabase){
      try {
        if(x.id) await supabase.from('schedules').update(row).eq('id',x.id)
        else await supabase.from('schedules').insert(row)
        await reload()
      } catch(err) {
        console.error('saveSchedule error:', err)
      }
    }
  }

  async function saveSchedulesBulk(items: Array<{ student_id: string; day_of_week: number; start_time: string; duration_minutes: number }>) {
    if (!items.length) return
    const student = students.find(s => s.id === items[0].student_id)
    
    const newRows = items.map(x => ({
      student_id: x.student_id,
      day_of_week: Number(x.day_of_week),
      start_time: (x.start_time || '07:00').slice(0,5),
      duration_minutes: Number(x.duration_minutes || settings.default_duration_minutes || 60),
      recurrence: 'weekly' as const,
      active: true
    }))

    const newScheduleObjects = newRows.map(row => ({
      id: uid(),
      ...row,
      student
    })) as Schedule[]

    setSchedules(prev => {
      let filtered = prev
      newRows.forEach(nr => {
        filtered = filtered.filter(s => !(s.student_id === nr.student_id && Number(s.day_of_week) === nr.day_of_week && s.start_time.slice(0,5) === nr.start_time))
      })
      const next = [...filtered, ...newScheduleObjects]
      persist(localSnapshot({ schedules: next }))
      return next
    })

    if (supabase) {
      try {
        await supabase.from('schedules').insert(newRows)
        await reload()
      } catch (err) {
        console.error('saveSchedulesBulk error:', err)
      }
    }
  }

  async function deleteSchedule(id:string){
    setSchedules(prev => {
      const next = prev.filter(s => s.id !== id)
      persist(localSnapshot({schedules:next}))
      return next
    })
    if(supabase){
      try {
        await supabase.from('schedules').update({active:false}).eq('id',id)
        await reload()
      } catch(err) {
        console.error('deleteSchedule error:', err)
      }
    }
  }

  async function saveException(x:Partial<ScheduleException>&{student_id:string;class_date:string;start_time:string;duration_minutes:number;status:ScheduleException['status']}){
    const cleanTime = (x.start_time || '07:00').slice(0,5)
    const exObj = {
      id: x.id || uid(),
      schedule_id: x.schedule_id || null,
      student_id: x.student_id,
      class_date: x.class_date,
      start_time: cleanTime,
      duration_minutes: Number(x.duration_minutes || 60),
      status: x.status,
      original_date: x.original_date || null,
      note: x.note || null,
      student: students.find(s => s.id === x.student_id)
    } as ScheduleException

    setExceptions(prev => {
      const next = [
        ...prev.filter(e => !(e.student_id === x.student_id && e.class_date === x.class_date && e.start_time.slice(0,5) === cleanTime)),
        exObj
      ]
      persist(localSnapshot({exceptions:next}))
      return next
    })

    if(supabase){
      try {
        const row = {
          schedule_id: x.schedule_id || null,
          student_id: x.student_id,
          class_date: x.class_date,
          start_time: cleanTime,
          duration_minutes: Number(x.duration_minutes || 60),
          status: x.status,
          original_date: x.original_date || null,
          note: x.note || null
        }
        await supabase.from('schedule_exceptions').upsert(row, {onConflict:'student_id,class_date,start_time'})
        await reload()
      } catch(err) {
        console.error('Supabase exception save error:', err)
      }
    }
  }

  async function deleteException(id:string){
    setExceptions(prev => {
      const next = prev.filter(e => e.id !== id)
      persist(localSnapshot({exceptions:next}))
      return next
    })
    if(supabase){
      try {
        await supabase.from('schedule_exceptions').delete().eq('id', id)
        await reload()
      } catch(err) {
        console.error('Supabase exception delete error:', err)
      }
    }
  }

  async function saveTask(x:Partial<TaskItem>&{title:string}){
    const row={
      id: x.id || uid(),
      title: x.title,
      student_id: x.student_id || null,
      class_date: x.class_date || null,
      due_at: x.due_at || null,
      priority: x.priority || 'medium',
      status: x.status || 'todo',
      note: x.note || null
    } as TaskItem

    setTasks(prev => {
      const next = x.id ? prev.map(t => t.id === x.id ? { ...t, ...row } : t) : [...prev, row]
      persist(localSnapshot({tasks:next}))
      return next
    })

    if(supabase){
      try {
        if(x.id) await supabase.from('tasks').update(row).eq('id',x.id)
        else await supabase.from('tasks').insert(row)
        await reload()
      } catch(err) {
        console.error('saveTask error:', err)
      }
    }
  }

  async function savePayment(x:Partial<Payment>&{student_id:string;month_key:string;amount:number}){
    const student = students.find(s => s.id === x.student_id)
    const row = {
      id: x.id || uid(),
      student_id: x.student_id,
      month_key: x.month_key,
      amount: Number(x.amount),
      note: x.note || null,
      paid_at: x.paid_at || new Date().toISOString(),
      student
    } as Payment

    setPayments(prev => {
      const next = [row, ...prev]
      persist(localSnapshot({payments:next}))
      return next
    })

    if(supabase){
      try {
        await supabase.from('payments').insert({
          student_id: row.student_id,
          month_key: row.month_key,
          amount: row.amount,
          note: row.note,
          paid_at: row.paid_at
        })
        await reload()
      } catch(err) {
        console.error('savePayment error:', err)
      }
    }
  }

  async function saveSettings(x:Partial<Settings>){
    const row={...settings,...x}
    setSettings(row)
    persist(localSnapshot({settings:row}))
    if(supabase){
      try {
        await supabase.from('app_settings').upsert(row)
        await reload()
      } catch(err) {
        console.error('saveSettings error:', err)
      }
    }
  }

  const value=useMemo(()=>({
    students,schedules,exceptions,tasks,payments,settings,reload,
    saveStudent,archiveStudent,saveSchedule,saveSchedulesBulk,deleteSchedule,saveException,deleteException,saveTask,savePayment,saveSettings
  }),[students,schedules,exceptions,tasks,payments,settings])

  return <C.Provider value={value}>{children}</C.Provider>
}

export function useData(){
  const x=useContext(C)
  if(!x)throw new Error('useData must be inside DataProvider')
  return x
}

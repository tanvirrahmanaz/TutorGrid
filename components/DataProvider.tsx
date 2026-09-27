'use client'
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { demoSchedules, demoStudents, demoTasks } from '@/lib/demo'
import type { Payment, Schedule, ScheduleException, Settings, Student, TaskItem } from '@/lib/types'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

type Ctx = {
  students: Student[];
  schedules: Schedule[];
  exceptions: ScheduleException[];
  tasks: TaskItem[];
  payments: Payment[];
  settings: Settings;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  syncErrorMsg: string | null;
  reload: () => Promise<void>;
  syncNow: () => Promise<void>;
  saveStudent: (x: Partial<Student>) => Promise<void>;
  archiveStudent: (id: string) => Promise<void>;
  saveSchedule: (x: Partial<Schedule> & { student_id: string }) => Promise<void>;
  saveSchedulesBulk: (items: Array<{ student_id: string; day_of_week: number; start_time: string; duration_minutes: number }>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  saveException: (x: Partial<ScheduleException> & { student_id: string; class_date: string; start_time: string; duration_minutes: number; status: ScheduleException['status'] }) => Promise<void>;
  saveExceptionsBulk: (items: Array<{ schedule_id?: string; student_id: string; class_date: string; start_time: string; duration_minutes: number; status: ScheduleException['status']; note?: string }>) => Promise<void>;
  deleteException: (id: string) => Promise<void>;
  saveTask: (x: Partial<TaskItem> & { title: string }) => Promise<void>;
  savePayment: (x: Partial<Payment> & { student_id: string; month_key: string; amount: number }) => Promise<void>;
  saveSettings: (x: Partial<Settings>) => Promise<void>;
}

const defaults: Settings = {
  id: 'default',
  day_start: '07:00',
  day_end: '22:00',
  interval_minutes: 30,
  default_duration_minutes: 60,
  reminder_minutes: 30
}

const C = createContext<Ctx | null>(null)
const LS = 'tutorgrid_demo_v1'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(str?: string | null): boolean {
  if (!str) return false
  return UUID_REGEX.test(str)
}

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Convert any legacy or non-UUID id to deterministic UUID
function toDeterministicUUID(str: string): string {
  if (isUUID(str)) return str
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `00000000-0000-4000-8000-${hex.repeat(3).slice(0, 12)}`
}

function getDeletedIds(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(`tutorgrid_deleted_${key}`)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function addDeletedId(key: string, id: string) {
  if (typeof window === 'undefined' || !id) return
  try {
    const set = getDeletedIds(key)
    set.add(id)
    localStorage.setItem(`tutorgrid_deleted_${key}`, JSON.stringify(Array.from(set).slice(-500)))
  } catch (e) {
    console.error('addDeletedId error:', e)
  }
}


function normalizeLocalData(raw: any) {
  if (!raw) return null
  const idMap = new Map<string, string>()

  const rawStudents: Student[] = Array.isArray(raw.students) ? raw.students : []
  const students: Student[] = rawStudents.map(s => {
    const oldId = s.id || uid()
    const validId = isUUID(oldId) ? oldId : toDeterministicUUID(oldId)
    idMap.set(oldId, validId)
    return {
      id: validId,
      name: s.name || 'Student',
      subject: s.subject || '',
      phone: s.phone || null,
      notes: s.notes || '',
      color: s.color || '#4f46e5',
      monthly_fee: Number(s.monthly_fee || 0),
      archived: !!s.archived,
      created_at: s.created_at || new Date().toISOString()
    }
  })

  const rawSchedules: Schedule[] = Array.isArray(raw.schedules) ? raw.schedules : []
  const schedules: Schedule[] = rawSchedules.map(sc => {
    const mappedStudentId = idMap.get(sc.student_id) || (isUUID(sc.student_id) ? sc.student_id : toDeterministicUUID(sc.student_id))
    const validId = isUUID(sc.id) ? sc.id : uid()
    return {
      id: validId,
      student_id: mappedStudentId,
      day_of_week: Number(sc.day_of_week ?? 0),
      start_time: (sc.start_time || '07:00').slice(0, 5),
      duration_minutes: Number(sc.duration_minutes || 60),
      recurrence: 'weekly',
      active: sc.active !== false,
      student: students.find(s => s.id === mappedStudentId)
    }
  })

  const rawExceptions: ScheduleException[] = Array.isArray(raw.exceptions) ? raw.exceptions : []
  const exceptions: ScheduleException[] = rawExceptions.map(ex => {
    const mappedStudentId = idMap.get(ex.student_id) || (isUUID(ex.student_id) ? ex.student_id : toDeterministicUUID(ex.student_id))
    const validId = isUUID(ex.id) ? ex.id : uid()
    return {
      id: validId,
      schedule_id: ex.schedule_id && isUUID(ex.schedule_id) ? ex.schedule_id : null,
      student_id: mappedStudentId,
      class_date: ex.class_date,
      start_time: (ex.start_time || '07:00').slice(0, 5),
      duration_minutes: Number(ex.duration_minutes || 60),
      status: ex.status,
      original_date: ex.original_date || null,
      note: ex.note || null,
      student: students.find(s => s.id === mappedStudentId)
    }
  })

  const rawTasks: TaskItem[] = Array.isArray(raw.tasks) ? raw.tasks : []
  const tasks: TaskItem[] = rawTasks.map(t => {
    const mappedStudentId = t.student_id ? (idMap.get(t.student_id) || (isUUID(t.student_id) ? t.student_id : toDeterministicUUID(t.student_id))) : null
    const validId = isUUID(t.id) ? t.id : uid()
    return {
      id: validId,
      title: t.title || 'Task',
      student_id: mappedStudentId,
      class_date: t.class_date || null,
      due_at: t.due_at || null,
      priority: t.priority || 'medium',
      status: t.status || 'todo',
      note: t.note || null
    }
  })

  const rawPayments: Payment[] = Array.isArray(raw.payments) ? raw.payments : []
  const payments: Payment[] = rawPayments.map(p => {
    const mappedStudentId = idMap.get(p.student_id) || (isUUID(p.student_id) ? p.student_id : toDeterministicUUID(p.student_id))
    const validId = isUUID(p.id) ? p.id : uid()
    return {
      id: validId,
      student_id: mappedStudentId,
      month_key: p.month_key || '',
      amount: Number(p.amount || 0),
      note: p.note || null,
      paid_at: p.paid_at || new Date().toISOString(),
      student: students.find(s => s.id === mappedStudentId)
    }
  })

  const settings: Settings = { ...defaults, ...(raw.settings || {}) }

  return { students, schedules, exceptions, tasks, payments, settings }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [settings, setSettings] = useState<Settings>(defaults)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null)

  const isSyncingRef = useRef(false)
  const lastActionTimestampRef = useRef<number>(0)
  const supabase = useMemo(() => getSupabaseBrowser(), [])

  function persistLocal(data: {
    students?: Student[]
    schedules?: Schedule[]
    exceptions?: ScheduleException[]
    tasks?: TaskItem[]
    payments?: Payment[]
    settings?: Settings
  }) {
    if (typeof window === 'undefined') return
    try {
      const currentRaw = localStorage.getItem(LS)
      const current = currentRaw ? JSON.parse(currentRaw) : {}
      const updated = {
        students: data.students ?? current.students ?? [],
        schedules: data.schedules ?? current.schedules ?? [],
        exceptions: data.exceptions ?? current.exceptions ?? [],
        tasks: data.tasks ?? current.tasks ?? [],
        payments: data.payments ?? current.payments ?? [],
        settings: data.settings ?? current.settings ?? defaults
      }
      localStorage.setItem(LS, JSON.stringify(updated))
    } catch (e) {
      console.error('persistLocal error:', e)
    }
  }

  function getLocalSnapshot() {
    if (typeof window === 'undefined') {
      return { students: demoStudents, schedules: demoSchedules, exceptions: [], tasks: demoTasks, payments: [], settings: defaults }
    }
    try {
      const raw = localStorage.getItem(LS)
      if (raw) {
        const parsed = JSON.parse(raw)
        const normalized = normalizeLocalData(parsed)
        if (normalized) return normalized
      }
    } catch (e) {
      console.error('getLocalSnapshot error:', e)
    }
    return { students: demoStudents, schedules: demoSchedules, exceptions: [], tasks: demoTasks, payments: [], settings: defaults }
  }

  // Auto-sync function: Pushes local data to Supabase and pulls the unified dataset
  const syncWithCloud = useCallback(async () => {
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    setSyncStatus('syncing')
    setSyncErrorMsg(null)

    if (!supabase) {
      // Offline / No Supabase configured
      const local = getLocalSnapshot()
      setStudents(local.students)
      setSchedules(local.schedules)
      setExceptions(local.exceptions)
      setTasks(local.tasks)
      setPayments(local.payments)
      setSettings(local.settings)
      setSyncStatus('offline')
      isSyncingRef.current = false
      return
    }

    try {
      // Read deleted tombstones to prevent resurrecting deleted items
      const deletedSchedIds = getDeletedIds('schedules')
      const deletedExIds = getDeletedIds('exceptions')
      const deletedStudIds = getDeletedIds('students')

      // 1. Fetch remote data
      const [remoteStudRes, remoteSchedRes, remoteExRes, remoteTaskRes, remotePayRes, remoteSetRes] = await Promise.all([
        supabase.from('students').select('*').order('name'),
        supabase.from('schedules').select('*,student:students(*)').eq('active', true),
        supabase.from('schedule_exceptions').select('*,student:students(*)'),
        supabase.from('tasks').select('*').order('due_at', { ascending: true }),
        supabase.from('payments').select('*,student:students(*)').order('paid_at', { ascending: false }),
        supabase.from('app_settings').select('*').limit(1).maybeSingle()
      ])

      // If remote returned an error (e.g., table permission or RLS error), handle gracefully
      if (remoteStudRes.error) {
        throw new Error(remoteStudRes.error.message || 'Supabase query failed')
      }

      const remoteStudents: Student[] = ((remoteStudRes.data || []) as Student[]).filter(s => !deletedStudIds.has(s.id))
      const remoteSchedules: Schedule[] = ((remoteSchedRes.data || []) as any[]).filter(s => !deletedSchedIds.has(s.id))
      const remoteExceptions: ScheduleException[] = ((remoteExRes.data || []) as any[]).filter(e => !deletedExIds.has(e.id))
      const remoteTasks: TaskItem[] = (remoteTaskRes.data || []) as any
      const remotePayments: Payment[] = (remotePayRes.data || []) as any
      const remoteSettings: Settings = remoteSetRes.data ? (remoteSetRes.data as any) : defaults

      // 2. Read local data to check if we have local unpushed items
      const local = getLocalSnapshot()
      // Purge any local tombstoned items
      local.students = local.students.filter(s => !deletedStudIds.has(s.id))
      local.schedules = local.schedules.filter(s => !deletedSchedIds.has(s.id))
      local.exceptions = local.exceptions.filter(e => !deletedExIds.has(e.id))
      persistLocal(local)

      // Find local students not in remote (and not deleted)
      const remoteStudentIds = new Set(remoteStudents.map(s => s.id))
      const localStudentsToPush = local.students.filter(s => isUUID(s.id) && !remoteStudentIds.has(s.id) && !deletedStudIds.has(s.id))

      if (localStudentsToPush.length > 0) {
        const rows = localStudentsToPush.map(s => ({
          id: s.id,
          name: s.name,
          subject: s.subject || '',
          phone: s.phone || null,
          notes: s.notes || '',
          color: s.color || '#4f46e5',
          monthly_fee: Number(s.monthly_fee || 0),
          archived: !!s.archived
        }))
        await supabase.from('students').upsert(rows, { onConflict: 'id' })
      }

      // Find local schedules to push (and NEVER push deleted schedules!)
      const remoteSchedIds = new Set(remoteSchedules.map(s => s.id))
      const localSchedsToPush = local.schedules.filter(sc => isUUID(sc.id) && !remoteSchedIds.has(sc.id) && !deletedSchedIds.has(sc.id))
      if (localSchedsToPush.length > 0) {
        const rows = localSchedsToPush.map(sc => ({
          id: sc.id,
          student_id: sc.student_id,
          day_of_week: Number(sc.day_of_week),
          start_time: sc.start_time.slice(0, 5),
          duration_minutes: Number(sc.duration_minutes || 60),
          recurrence: 'weekly',
          active: true
        }))
        await supabase.from('schedules').upsert(rows, { onConflict: 'id' })
      }

      // Find local exceptions to push (and NEVER push deleted exceptions!)
      const remoteExKeys = new Set(remoteExceptions.map(e => `${e.student_id}_${e.class_date}_${e.start_time.slice(0, 5)}`))
      const localExToPush = local.exceptions.filter(e => !remoteExKeys.has(`${e.student_id}_${e.class_date}_${e.start_time.slice(0, 5)}`) && !deletedExIds.has(e.id))
      if (localExToPush.length > 0) {
        const rows = localExToPush.map(e => ({
          schedule_id: e.schedule_id && isUUID(e.schedule_id) ? e.schedule_id : null,
          student_id: e.student_id,
          class_date: e.class_date,
          start_time: e.start_time.slice(0, 5),
          duration_minutes: Number(e.duration_minutes || 60),
          status: e.status,
          original_date: e.original_date || null,
          note: e.note || null
        }))
        await supabase.from('schedule_exceptions').upsert(rows, { onConflict: 'student_id,class_date,start_time' })
      }

      // Find local tasks to push
      const remoteTaskIds = new Set(remoteTasks.map(t => t.id))
      const localTasksToPush = local.tasks.filter(t => isUUID(t.id) && !remoteTaskIds.has(t.id))
      if (localTasksToPush.length > 0) {
        const rows = localTasksToPush.map(t => ({
          id: t.id,
          title: t.title,
          student_id: t.student_id && isUUID(t.student_id) ? t.student_id : null,
          class_date: t.class_date || null,
          due_at: t.due_at || null,
          priority: t.priority || 'medium',
          status: t.status || 'todo',
          note: t.note || null
        }))
        await supabase.from('tasks').upsert(rows, { onConflict: 'id' })
      }

      // Find local payments to push
      const remotePayIds = new Set(remotePayments.map(p => p.id))
      const localPaysToPush = local.payments.filter(p => isUUID(p.id) && !remotePayIds.has(p.id))
      if (localPaysToPush.length > 0) {
        const rows = localPaysToPush.map(p => ({
          id: p.id,
          student_id: p.student_id,
          month_key: p.month_key,
          amount: Number(p.amount || 0),
          note: p.note || null,
          paid_at: p.paid_at || new Date().toISOString()
        }))
        await supabase.from('payments').upsert(rows, { onConflict: 'id' })
      }

      // 3. Re-fetch consolidated data from Supabase to ensure complete synchronization
      const [finalStud, finalSched, finalEx, finalTask, finalPay] = await Promise.all([
        supabase.from('students').select('*').order('name'),
        supabase.from('schedules').select('*,student:students(*)').eq('active', true),
        supabase.from('schedule_exceptions').select('*,student:students(*)'),
        supabase.from('tasks').select('*').order('due_at', { ascending: true }),
        supabase.from('payments').select('*,student:students(*)').order('paid_at', { ascending: false })
      ])

      // Clean up any stale remote items that were deleted locally
      const staleRemoteSchedules = ((finalSched.data || []) as any[]).filter(s => deletedSchedIds.has(s.id))
      if (staleRemoteSchedules.length > 0) {
        for (const st of staleRemoteSchedules) {
          supabase.from('schedules').delete().eq('id', st.id).then(() => {})
        }
      }
      const staleRemoteExceptions = ((finalEx.data || []) as any[]).filter(e => deletedExIds.has(e.id))
      if (staleRemoteExceptions.length > 0) {
        for (const ste of staleRemoteExceptions) {
          supabase.from('schedule_exceptions').delete().eq('id', ste.id).then(() => {})
        }
      }

      const mergedStudents = ((finalStud.data || []) as Student[]).filter(s => !deletedStudIds.has(s.id))
      const mergedSchedules = ((finalSched.data || []) as Schedule[]).filter(s => !deletedSchedIds.has(s.id))
      const mergedExceptions = ((finalEx.data || []) as ScheduleException[]).filter(e => !deletedExIds.has(e.id))
      const mergedTasks = (finalTask.data || []) as any
      const mergedPayments = (finalPay.data || []) as any

      setStudents(mergedStudents)
      setSchedules(mergedSchedules)
      setExceptions(mergedExceptions)
      setTasks(mergedTasks)
      setPayments(mergedPayments)
      setSettings(remoteSettings)

      // Persist unified data into localStorage for seamless instant loading and offline capability
      persistLocal({
        students: mergedStudents,
        schedules: mergedSchedules,
        exceptions: mergedExceptions,
        tasks: mergedTasks,
        payments: mergedPayments,
        settings: remoteSettings
      })

      setSyncStatus('synced')
      setLastSyncedAt(new Date())
    } catch (err: any) {
      console.error('Sync error:', err)
      // Fallback to local
      const local = getLocalSnapshot()
      const deletedSchedIds = getDeletedIds('schedules')
      const deletedExIds = getDeletedIds('exceptions')
      const deletedStudIds = getDeletedIds('students')
      setStudents(local.students.filter(s => !deletedStudIds.has(s.id)))
      setSchedules(local.schedules.filter(s => !deletedSchedIds.has(s.id)))
      setExceptions(local.exceptions.filter(e => !deletedExIds.has(e.id)))
      setTasks(local.tasks)
      setPayments(local.payments)
      setSettings(local.settings)
      setSyncStatus('error')
      setSyncErrorMsg(err?.message || 'Database sync encountered an issue. Saved locally.')
    } finally {
      isSyncingRef.current = false
    }
  }, [supabase])

  useEffect(() => {
    // Initial sync
    syncWithCloud()

    // Listen for window focus to auto-refresh cross-device updates (debounced against recent user actions)
    const onFocus = () => {
      if (Date.now() - lastActionTimestampRef.current < 5000) {
        return
      }
      syncWithCloud()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [syncWithCloud])


  async function saveStudent(x: Partial<Student>) {
    const studentId = x.id && isUUID(x.id) ? x.id : uid()
    const newStudent: Student = {
      id: studentId,
      name: (x.name || 'Student').trim(),
      subject: x.subject || '',
      color: x.color || '#4f46e5',
      phone: x.phone || null,
      notes: x.notes || '',
      monthly_fee: Number(x.monthly_fee || 0),
      archived: x.archived || false,
      created_at: x.created_at || new Date().toISOString()
    }

    setStudents(prev => {
      const next = x.id ? prev.map(s => s.id === x.id ? { ...s, ...newStudent } : s) : [...prev, newStudent]
      persistLocal({ students: next })
      return next
    })

    if (supabase) {
      try {
        const row = {
          id: newStudent.id,
          name: newStudent.name,
          subject: newStudent.subject,
          color: newStudent.color,
          phone: newStudent.phone,
          notes: newStudent.notes,
          monthly_fee: newStudent.monthly_fee,
          archived: newStudent.archived
        }
        await supabase.from('students').upsert(row, { onConflict: 'id' })
        setSyncStatus('synced')
        setLastSyncedAt(new Date())
      } catch (err: any) {
        console.error('saveStudent error:', err)
        setSyncStatus('error')
        setSyncErrorMsg(err.message)
      }
    }
  }

  async function archiveStudent(id: string) {
    setStudents(prev => {
      const next = prev.map(s => s.id === id ? { ...s, archived: true } : s)
      persistLocal({ students: next })
      return next
    })
    if (supabase) {
      try {
        await supabase.from('students').update({ archived: true }).eq('id', id)
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('archiveStudent error:', err)
      }
    }
  }

  async function saveSchedule(x: Partial<Schedule> & { student_id: string }) {
    const student = students.find(s => s.id === x.student_id)
    const cleanTime = (x.start_time || '07:00').slice(0, 5)
    const scheduleId = x.id && isUUID(x.id) ? x.id : uid()
    const row = {
      id: scheduleId,
      student_id: x.student_id,
      day_of_week: Number(x.day_of_week ?? 0),
      start_time: cleanTime,
      duration_minutes: Number(x.duration_minutes || settings.default_duration_minutes || 60),
      recurrence: 'weekly' as const,
      active: true
    }
    const newSchedule: Schedule = { ...row, student }

    setSchedules(prev => {
      const next = x.id
        ? prev.map(s => s.id === x.id ? { ...s, ...row, student } : s)
        : [...prev.filter(s => !(s.student_id === x.student_id && Number(s.day_of_week) === Number(row.day_of_week) && s.start_time.slice(0, 5) === cleanTime)), newSchedule]
      persistLocal({ schedules: next })
      return next
    })

    if (supabase) {
      try {
        await supabase.from('schedules').upsert(row, { onConflict: 'id' })
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('saveSchedule error:', err)
      }
    }
  }

  async function saveSchedulesBulk(items: Array<{ student_id: string; day_of_week: number; start_time: string; duration_minutes: number }>) {
    if (!items.length) return
    const student = students.find(s => s.id === items[0].student_id)

    const newRows = items.map(x => ({
      id: uid(),
      student_id: x.student_id,
      day_of_week: Number(x.day_of_week),
      start_time: (x.start_time || '07:00').slice(0, 5),
      duration_minutes: Number(x.duration_minutes || settings.default_duration_minutes || 60),
      recurrence: 'weekly' as const,
      active: true
    }))

    const newScheduleObjects: Schedule[] = newRows.map(row => ({
      ...row,
      student
    }))

    setSchedules(prev => {
      let filtered = prev
      newRows.forEach(nr => {
        filtered = filtered.filter(s => !(s.student_id === nr.student_id && Number(s.day_of_week) === nr.day_of_week && s.start_time.slice(0, 5) === nr.start_time))
      })
      const next = [...filtered, ...newScheduleObjects]
      persistLocal({ schedules: next })
      return next
    })

    if (supabase) {
      try {
        await supabase.from('schedules').upsert(newRows, { onConflict: 'id' })
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('saveSchedulesBulk error:', err)
      }
    }
  }

  async function deleteSchedule(id: string) {
    lastActionTimestampRef.current = Date.now()
    addDeletedId('schedules', id)

    const target = schedules.find(s => s.id === id)

    // Optimistic local removal
    setSchedules(prev => {
      const next = prev.filter(s => s.id !== id)
      persistLocal({ schedules: next })
      return next
    })

    if (supabase) {
      try {
        // Hard delete from Supabase
        await supabase.from('schedules').delete().eq('id', id)

        // Also delete any duplicate active rows for the same student+day+time slot
        if (target) {
          const cleanTime = target.start_time.slice(0, 5)
          // Delete all schedules for this student on this day at this time (catches duplicates)
          await supabase.from('schedules').delete()
            .eq('student_id', target.student_id)
            .eq('day_of_week', Number(target.day_of_week))
            .gte('start_time', cleanTime)
            .lte('start_time', cleanTime + ':59')
          // Delete orphaned exceptions linked to this schedule
          await supabase.from('schedule_exceptions').delete().eq('schedule_id', id)
        }

        // Re-fetch schedules from Supabase and update state
        const deletedSchedIds = getDeletedIds('schedules')
        const { data: freshScheds } = await supabase.from('schedules').select('*,student:students(*)').eq('active', true)
        const cleanScheds = ((freshScheds || []) as Schedule[]).filter(s => !deletedSchedIds.has(s.id))
        setSchedules(cleanScheds)
        persistLocal({ schedules: cleanScheds })
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('deleteSchedule error:', err)
      }
    }
  }

  async function saveException(x: Partial<ScheduleException> & { student_id: string; class_date: string; start_time: string; duration_minutes: number; status: ScheduleException['status'] }) {
    const cleanTime = (x.start_time || '07:00').slice(0, 5)
    const exId = x.id && isUUID(x.id) ? x.id : uid()
    const exObj: ScheduleException = {
      id: exId,
      schedule_id: x.schedule_id && isUUID(x.schedule_id) ? x.schedule_id : null,
      student_id: x.student_id,
      class_date: x.class_date,
      start_time: cleanTime,
      duration_minutes: Number(x.duration_minutes || 60),
      status: x.status,
      original_date: x.original_date || null,
      note: x.note || null,
      student: students.find(s => s.id === x.student_id)
    }

    setExceptions(prev => {
      const next = [
        ...prev.filter(e => !(e.student_id === x.student_id && e.class_date === x.class_date && e.start_time.slice(0, 5) === cleanTime)),
        exObj
      ]
      persistLocal({ exceptions: next })
      return next
    })

    if (supabase) {
      try {
        const row = {
          schedule_id: exObj.schedule_id,
          student_id: exObj.student_id,
          class_date: exObj.class_date,
          start_time: cleanTime,
          duration_minutes: exObj.duration_minutes,
          status: exObj.status,
          original_date: exObj.original_date,
          note: exObj.note
        }
        await supabase.from('schedule_exceptions').upsert(row, { onConflict: 'student_id,class_date,start_time' })
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('Supabase exception save error:', err)
      }
    }
  }

  async function saveExceptionsBulk(items: Array<{ schedule_id?: string; student_id: string; class_date: string; start_time: string; duration_minutes: number; status: ScheduleException['status']; note?: string }>) {
    if (!items.length) return
    const newExObjs: ScheduleException[] = items.map(x => ({
      id: uid(),
      schedule_id: x.schedule_id && isUUID(x.schedule_id) ? x.schedule_id : null,
      student_id: x.student_id,
      class_date: x.class_date,
      start_time: (x.start_time || '07:00').slice(0, 5),
      duration_minutes: Number(x.duration_minutes || 60),
      status: x.status,
      original_date: null,
      note: x.note || null,
      student: students.find(s => s.id === x.student_id)
    }))

    setExceptions(prev => {
      let filtered = prev
      newExObjs.forEach(ne => {
        filtered = filtered.filter(e => !(e.student_id === ne.student_id && e.class_date === ne.class_date && e.start_time.slice(0, 5) === ne.start_time.slice(0, 5)))
      })
      const next = [...filtered, ...newExObjs]
      persistLocal({ exceptions: next })
      return next
    })

    if (supabase) {
      try {
        const rows = newExObjs.map(ne => ({
          schedule_id: ne.schedule_id,
          student_id: ne.student_id,
          class_date: ne.class_date,
          start_time: ne.start_time.slice(0, 5),
          duration_minutes: ne.duration_minutes,
          status: ne.status,
          original_date: null,
          note: ne.note || null
        }))
        await supabase.from('schedule_exceptions').upsert(rows, { onConflict: 'student_id,class_date,start_time' })
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('saveExceptionsBulk error:', err)
      }
    }
  }

  async function deleteException(id: string) {
    lastActionTimestampRef.current = Date.now()
    addDeletedId('exceptions', id)

    // Optimistic local removal
    setExceptions(prev => {
      const next = prev.filter(e => e.id !== id)
      persistLocal({ exceptions: next })
      return next
    })

    if (supabase) {
      try {
        await supabase.from('schedule_exceptions').delete().eq('id', id)

        // Re-fetch exceptions from Supabase and update state (prevents resurrection)
        const deletedExIds = getDeletedIds('exceptions')
        const { data: freshEx } = await supabase.from('schedule_exceptions').select('*,student:students(*)')
        const cleanEx = ((freshEx || []) as ScheduleException[]).filter(e => !deletedExIds.has(e.id))
        setExceptions(cleanEx)
        persistLocal({ exceptions: cleanEx })
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('Supabase exception delete error:', err)
      }
    }
  }

  async function saveTask(x: Partial<TaskItem> & { title: string }) {
    const taskId = x.id && isUUID(x.id) ? x.id : uid()
    const row: TaskItem = {
      id: taskId,
      title: x.title,
      student_id: x.student_id && isUUID(x.student_id) ? x.student_id : null,
      class_date: x.class_date || null,
      due_at: x.due_at || null,
      priority: x.priority || 'medium',
      status: x.status || 'todo',
      note: x.note || null
    }

    setTasks(prev => {
      const next = x.id ? prev.map(t => t.id === x.id ? { ...t, ...row } : t) : [...prev, row]
      persistLocal({ tasks: next })
      return next
    })

    if (supabase) {
      try {
        await supabase.from('tasks').upsert({
          id: row.id,
          title: row.title,
          student_id: row.student_id,
          class_date: row.class_date,
          due_at: row.due_at,
          priority: row.priority,
          status: row.status,
          note: row.note
        }, { onConflict: 'id' })
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('saveTask error:', err)
      }
    }
  }

  async function savePayment(x: Partial<Payment> & { student_id: string; month_key: string; amount: number }) {
    const student = students.find(s => s.id === x.student_id)
    const paymentId = x.id && isUUID(x.id) ? x.id : uid()
    const row: Payment = {
      id: paymentId,
      student_id: x.student_id,
      month_key: x.month_key,
      amount: Number(x.amount),
      note: x.note || null,
      paid_at: x.paid_at || new Date().toISOString(),
      student
    }

    setPayments(prev => {
      const next = [row, ...prev]
      persistLocal({ payments: next })
      return next
    })

    if (supabase) {
      try {
        await supabase.from('payments').upsert({
          id: row.id,
          student_id: row.student_id,
          month_key: row.month_key,
          amount: row.amount,
          note: row.note,
          paid_at: row.paid_at
        }, { onConflict: 'id' })
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('savePayment error:', err)
      }
    }
  }

  async function saveSettings(x: Partial<Settings>) {
    const row = { ...settings, ...x }
    setSettings(row)
    persistLocal({ settings: row })
    if (supabase) {
      try {
        await supabase.from('app_settings').upsert(row)
        setSyncStatus('synced')
      } catch (err: any) {
        console.error('saveSettings error:', err)
      }
    }
  }

  const value = useMemo(() => ({
    students,
    schedules,
    exceptions,
    tasks,
    payments,
    settings,
    syncStatus,
    lastSyncedAt,
    syncErrorMsg,
    reload: syncWithCloud,
    syncNow: syncWithCloud,
    saveStudent,
    archiveStudent,
    saveSchedule,
    saveSchedulesBulk,
    deleteSchedule,
    saveException,
    saveExceptionsBulk,
    deleteException,
    saveTask,
    savePayment,
    saveSettings
  }), [students, schedules, exceptions, tasks, payments, settings, syncStatus, lastSyncedAt, syncErrorMsg, syncWithCloud])

  return <C.Provider value={value}>{children}</C.Provider>
}

export function useData() {
  const x = useContext(C)
  if (!x) throw new Error('useData must be inside DataProvider')
  return x
}

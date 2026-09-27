export type Student = {
  id: string
  name: string
  subject: string
  color: string
  phone?: string | null
  notes?: string | null
  monthly_fee?: number | null
  archived: boolean
  created_at?: string
}

export type Schedule = {
  id: string
  student_id: string
  day_of_week: number
  start_time: string
  duration_minutes: number
  recurrence: 'weekly'
  active: boolean
  created_at?: string
  student?: Student
}

export type ScheduleException = {
  id: string
  schedule_id?: string | null
  student_id: string
  class_date: string
  start_time: string
  duration_minutes: number
  status: 'scheduled' | 'off' | 'cancelled' | 'rescheduled' | 'missed' | 'completed' | 'absent'
  original_date?: string | null
  note?: string | null
  created_at?: string
  student?: Student
}

export type LessonLog = {
  id: string
  student_id: string
  class_date: string
  homework_assigned?: string | null
  next_lesson?: string | null
  lesson_note?: string | null
  attendance_status?: string | null
}

export type TaskItem = {
  id: string
  title: string
  student_id?: string | null
  class_date?: string | null
  due_at?: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in_progress' | 'done'
  note?: string | null
}

export type Payment = {
  id: string
  student_id: string
  month_key: string
  amount: number
  note?: string | null
  paid_at: string
  student?: Student
}

export type Settings = {
  id: string
  day_start: string
  day_end: string
  interval_minutes: number
  default_duration_minutes: number
  reminder_minutes: number
}

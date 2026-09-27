'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import { useData } from '@/components/DataProvider'
import { getSupabaseBrowser } from '@/lib/supabase'
import { DAYS, prettyTime } from '@/lib/utils'
import { Calendar, Clock, Plus, Trash2, Pencil, AlertTriangle, ExternalLink } from 'lucide-react'

function Detail() {
  const { id } = useParams<{ id: string }>()
  const { students, schedules, saveSchedule, deleteSchedule } = useData()
  const student = students.find(s => s.id === id)
  
  const [logs, setLogs] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [schedModal, setSchedModal] = useState<any>(null) // null = closed, {} = add new, { id, ... } = edit
  
  const supabase = getSupabaseBrowser()

  const studentSchedules = schedules
    .filter(s => s.student_id === id && s.active !== false)
    .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week) || a.start_time.localeCompare(b.start_time))

  async function load() {
    if (!supabase) return
    const [{ data: l }, { data: f }] = await Promise.all([
      supabase.from('lesson_logs').select('*').eq('student_id', id).order('class_date', { ascending: false }),
      supabase.from('student_files').select('*').eq('student_id', id).order('created_at', { ascending: false })
    ])
    setLogs(l || [])
    setFiles(f || [])
  }

  useEffect(() => { load() }, [id])

  async function addLog(fd: FormData) {
    if (!supabase) { setMsg('Lesson history requires Supabase configuration.'); return }
    const { error } = await supabase.from('lesson_logs').insert({
      student_id: id,
      class_date: String(fd.get('class_date')),
      homework_assigned: String(fd.get('homework_assigned') || ''),
      next_lesson: String(fd.get('next_lesson') || ''),
      lesson_note: String(fd.get('lesson_note') || ''),
      attendance_status: String(fd.get('attendance_status') || 'completed')
    })
    setMsg(error?.message || 'Lesson saved.')
    load()
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !supabase) return
    const path = `${id}/${Date.now()}-${file.name}`
    const up = await supabase.storage.from('student-files').upload(path, file)
    if (up.error) { setMsg(up.error.message); return }
    const { error } = await supabase.from('student_files').insert({
      student_id: id,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type
    })
    setMsg(error?.message || 'File uploaded.')
    load()
  }

  async function openFile(path: string) {
    if (!supabase) return
    const { data, error } = await supabase.storage.from('student-files').createSignedUrl(path, 60)
    if (error) { setMsg(error.message); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteFile(fileId: string, path: string) {
    if (!supabase) return
    await supabase.storage.from('student-files').remove([path])
    const { error } = await supabase.from('student_files').delete().eq('id', fileId)
    setMsg(error?.message || 'File deleted.')
    load()
  }

  async function handleSaveSchedule(fd: FormData) {
    const day = Number(fd.get('day_of_week'))
    const time = String(fd.get('start_time'))
    const dur = Number(fd.get('duration_minutes') || 60)

    await saveSchedule({
      id: schedModal?.id,
      student_id: id,
      day_of_week: day,
      start_time: time,
      duration_minutes: dur
    })
    setSchedModal(null)
  }

  async function handleDeleteSchedule(schedId: string, dayName: string) {
    if (confirm(`Are you sure you want to permanently delete this ${dayName} weekly class for ${student?.name}?`)) {
      await deleteSchedule(schedId)
    }
  }

  if (!student) return <div className="empty">Student not found.</div>

  return (
    <>
      <Topbar 
        title={student.name} 
        subtitle={`${student.subject || 'No subject'} · Schedule, lesson history & syllabus`} 
        actions={
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => setSchedModal({ day_of_week: 0, start_time: '07:00', duration_minutes: 60 })}
          >
            <Plus size={15}/> Add Weekly Schedule
          </button>
        }
      />

      {/* 1. Weekly Class Schedule Management Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color="#4f46e5" /> সাপ্তাহিক পড়ার রুটিন (Weekly Class Schedule)
            </h3>
            <div className="sub" style={{ fontSize: 12 }}>
              Manage, edit time, or delete weekly recurring classes for {student.name}
            </div>
          </div>

          <button 
            type="button" 
            className="btn btn-soft" 
            onClick={() => setSchedModal({ day_of_week: 0, start_time: '07:00', duration_minutes: 60 })}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            <Plus size={14} /> নতুন ক্লাস দিন যোগ করুন
          </button>
        </div>

        {studentSchedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', background: '#fff7ed', borderRadius: 12, border: '1px solid #fed7aa' }}>
            <AlertTriangle size={24} style={{ color: '#ea580c', margin: '0 auto 6px' }} />
            <b style={{ color: '#9a3412', display: 'block', fontSize: 14 }}>এই ছাত্রের কোনো সাপ্তাহিক শিডিউল সেট করা নেই!</b>
            <p style={{ fontSize: 12, color: '#c2410c', margin: '4px 0 12px' }}>
              কবে কোন সময়ে পড়াবেন তা ঠিক করতে নিচের বাটনে ক্লিক করুন।
            </p>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={() => setSchedModal({ day_of_week: 0, start_time: '07:00', duration_minutes: 60 })}
            >
              <Plus size={14} /> শিডিউল সেট করুন
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {studentSchedules.map(sc => {
              const dayName = DAYS[sc.day_of_week]
              return (
                <div 
                  key={sc.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                      {dayName}
                    </div>
                    <div style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Clock size={12} /> {prettyTime(sc.start_time)} ({sc.duration_minutes} min)
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => setSchedModal(sc)}
                      title="Edit Schedule Time"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px', fontSize: 12, color: '#dc2626', border: '1px solid #fecaca' }}
                      onClick={() => handleDeleteSchedule(sc.id, dayName)}
                      title="Delete Schedule"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Lesson Logging & Files */}
      <div className="grid grid-2">
        <div className="card">
          <h3 className="section-title">Add date-wise lesson record</h3>
          <form action={addLog} className="list">
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" name="class_date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="field">
              <label>What I taught / lesson note</label>
              <textarea className="textarea" rows={3} name="lesson_note" placeholder="Topics covered today..." />
            </div>
            <div className="field">
              <label>Homework / assigned</label>
              <textarea className="textarea" rows={3} name="homework_assigned" placeholder="Exercise / chapters assigned..." />
            </div>
            <div className="field">
              <label>Next lesson / what to teach</label>
              <textarea className="textarea" rows={3} name="next_lesson" placeholder="Plan for next class..." />
            </div>
            <div className="field">
              <label>Attendance status</label>
              <select className="select" name="attendance_status">
                <option value="completed">Completed (Present)</option>
                <option value="absent">Student absent</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="missed">Missed</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Save lesson</button>
          </form>
        </div>

        <div className="card">
          <h3 className="section-title">Syllabus & files</h3>
          <input className="input" type="file" accept=".pdf,.doc,.docx,image/*" onChange={upload} />
          <p className="sub" style={{ fontSize: 12 }}>Multiple files supported through Supabase Storage bucket <b>student-files</b>.</p>
          <div className="list" style={{ marginTop: 12 }}>
            {files.map(f => (
              <div className="list-item" key={f.id}>
                <b>{f.file_name}</b>
                <div style={{display:'flex', alignItems:'center', gap:6}}>
                  <span className="badge">{f.mime_type || 'file'}</span>
                  <button type="button" className="btn btn-ghost" onClick={() => openFile(f.storage_path)} title="Open file">
                    <ExternalLink size={14}/>
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => deleteFile(f.id, f.storage_path)} title="Delete file" style={{color:'#dc2626'}}>
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            ))}
            {!files.length && <div className="sub">No syllabus or files uploaded yet.</div>}
          </div>
        </div>
      </div>

      {/* 3. Lesson History List */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="section-title">Lesson history</h3>
        <div className="list">
          {logs.map(l => (
            <div className="list-item" key={l.id}>
              <div>
                <b>{l.class_date} · {l.attendance_status}</b>
                <div className="sub">Taught: {l.lesson_note || '—'}</div>
                <div className="sub">Homework: {l.homework_assigned || '—'}</div>
                <div className="sub">Next: {l.next_lesson || '—'}</div>
              </div>
            </div>
          ))}
          {!logs.length && <div className="empty">No lesson history yet.</div>}
        </div>
      </div>

      {msg && <div className="card" style={{ marginTop: 16, background: '#f8fafc' }}>{msg}</div>}

      {/* Schedule Edit / Add Modal */}
      {schedModal && (
        <Modal 
          title={schedModal.id ? `Edit Schedule — ${student.name}` : `Add Weekly Schedule — ${student.name}`} 
          onClose={() => setSchedModal(null)}
        >
          <form action={handleSaveSchedule} className="form-grid">
            <div className="field">
              <label>সপ্তাহের দিন (Day of Week)</label>
              <select className="select" name="day_of_week" defaultValue={schedModal.day_of_week ?? 0}>
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>শুরুর সময় (Start Time)</label>
              <input 
                className="input" 
                type="time" 
                name="start_time" 
                defaultValue={(schedModal.start_time || '07:00').slice(0, 5)} 
                required 
              />
            </div>

            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>সময়কাল (Duration in minutes)</label>
              <input 
                className="input" 
                type="number" 
                name="duration_minutes" 
                defaultValue={schedModal.duration_minutes || 60} 
                min={15} 
                step={15} 
                required 
              />
            </div>

            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn btn-primary" type="submit" style={{ flex: 1, padding: 12 }}>
                ✓ {schedModal.id ? 'Save Changes' : 'Add to Schedule'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setSchedModal(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

export default function Page() {
  return (
    <ProtectedLayout>
      <Detail />
    </ProtectedLayout>
  )
}

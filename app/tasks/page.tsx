'use client'
import {useState} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import {useData} from '@/components/DataProvider'
import {Plus, Trash2} from 'lucide-react'

function Tasks(){
  const {tasks, students, saveTask, deleteTask} = useData()
  const [modal, setModal] = useState(false)

  async function add(fd: FormData) {
    await saveTask({
      title: String(fd.get('title')),
      student_id: String(fd.get('student_id') || '') || null,
      due_at: String(fd.get('due_at') || '') || null,
      priority: String(fd.get('priority') || 'medium') as any,
      status: 'todo',
      note: String(fd.get('note') || '')
    })
    setModal(false)
  }

  return <>
    <Topbar
      title="Tasks"
      subtitle="General tasks or tasks linked to a student/class date"
      actions={<button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={16}/> Add task</button>}
    />
    <div className="card">
      <table className="table">
        <thead>
          <tr><th>Task</th><th>Student</th><th>Due</th><th>Priority</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id}>
              <td><b>{t.title}</b><div className="sub">{t.note}</div></td>
              <td>{students.find(s => s.id === t.student_id)?.name || '-'}</td>
              <td>{t.due_at ? new Date(t.due_at).toLocaleString() : '-'}</td>
              <td><span className={'badge ' + (t.priority === 'high' ? 'red' : '')}>{t.priority}</span></td>
              <td>{t.status.replace('_',' ')}</td>
              <td style={{display:'flex', gap:6, justifyContent:'flex-end'}}>
                <button className="btn btn-ghost" onClick={() => saveTask({...t, status: t.status === 'done' ? 'todo' : 'done'})}>
                  {t.status === 'done' ? 'Reopen' : 'Done'}
                </button>
                <button className="btn btn-ghost" onClick={() => deleteTask(t.id)} title="Delete task" style={{color:'#dc2626'}}>
                  <Trash2 size={14}/>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {modal && (
      <Modal title="Add task" onClose={() => setModal(false)}>
        <form action={add} className="form-grid">
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label>Title</label>
            <input className="input" name="title" required/>
          </div>
          <div className="field">
            <label>Student (optional)</label>
            <select className="select" name="student_id">
              <option value="">None</option>
              {students.filter(s => !s.archived).map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Due date/time</label>
            <input className="input" type="datetime-local" name="due_at"/>
          </div>
          <div className="field">
            <label>Priority</label>
            <select className="select" name="priority"><option>low</option><option>medium</option><option>high</option></select>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label>Note</label>
            <textarea className="textarea" name="note" rows={3}/>
          </div>
          <button className="btn btn-primary">Save task</button>
        </form>
      </Modal>
    )}
  </>
}

export default function Page(){return <ProtectedLayout><Tasks/></ProtectedLayout>}

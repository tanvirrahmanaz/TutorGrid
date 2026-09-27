'use client'
import {useState} from 'react'
import ProtectedLayout from '@/components/ProtectedLayout'
import Topbar from '@/components/Topbar'
import Modal from '@/components/Modal'
import {useData} from '@/components/DataProvider'
import {currency} from '@/lib/utils'
import {Plus, Pencil, TrendingUp, Wallet, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Trash2} from 'lucide-react'
import {format, addMonths, subMonths, parseISO} from 'date-fns'

function Payments(){
  const {students, payments, savePayment, deletePayment, saveStudent} = useData()
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState<any>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const month = format(currentMonth, 'yyyy-MM')
  const monthLabel = format(currentMonth, 'MMMM yyyy')

  const rows = students.filter(s => !s.archived).map(s => {
    const paid = payments
      .filter(p => p.student_id === s.id && p.month_key === month)
      .reduce((a, p) => a + Number(p.amount), 0)
    const fee = Number(s.monthly_fee || 0)
    return { s, paid, fee, due: Math.max(0, fee - paid), overpaid: Math.max(0, paid - fee) }
  })

  const totalMonthly = rows.reduce((a, r) => a + r.fee, 0)
  const totalReceived = rows.reduce((a, r) => a + r.paid, 0)
  const totalDue = rows.reduce((a, r) => a + r.due, 0)
  const paidCount = rows.filter(r => r.due === 0 && r.fee > 0).length
  const dueCount = rows.filter(r => r.due > 0).length

  async function addPayment(fd: FormData) {
    await savePayment({
      student_id: String(fd.get('student_id')),
      month_key: String(fd.get('month_key')),
      amount: Number(fd.get('amount')),
      note: String(fd.get('note') || '')
    })
    setAddModal(false)
  }

  async function saveEdit(fd: FormData) {
    if (!editModal) return
    await saveStudent({ ...editModal.s, monthly_fee: Number(fd.get('monthly_fee')) })
    // Also record payment if amount provided
    const amt = Number(fd.get('amount'))
    if (amt > 0) {
      await savePayment({
        student_id: editModal.s.id,
        month_key: month,
        amount: amt,
        note: String(fd.get('note') || '')
      })
    }
    setEditModal(null)
  }

  function statusBadge(r: typeof rows[0]) {
    if (r.fee === 0) return <span style={badge('#f2f4f7','#475467')}>No fee set</span>
    if (r.overpaid > 0) return <span style={badge('#e0f2fe','#0369a1')}>Overpaid</span>
    if (r.due === 0) return <span style={badge('#dcfce7','#047857')}>✓ Paid</span>
    if (r.paid > 0) return <span style={badge('#fef3c7','#b45309')}>Partial</span>
    return <span style={badge('#fee2e2','#b91c1c')}>Due</span>
  }

  function badge(bg: string, color: string) {
    return {background: bg, color, fontSize: 12, padding: '4px 10px', borderRadius: 999, fontWeight: 700, display:'inline-block'}
  }

  return <>
    <Topbar
      title="Payments"
      subtitle={`Tuition ledger · ${monthLabel}`}
      actions={<button className="btn btn-primary" onClick={() => setAddModal(true)}><Plus size={16}/> Add payment</button>}
    />

    {/* Month navigator */}
    <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
      <button className="btn btn-ghost" onClick={() => setCurrentMonth(subMonths(currentMonth,1))} style={{padding:'8px 12px'}}>
        <ChevronLeft size={16}/>
      </button>
      <span style={{fontWeight:700, fontSize:16, minWidth:140, textAlign:'center'}}>{monthLabel}</span>
      <button className="btn btn-ghost" onClick={() => setCurrentMonth(addMonths(currentMonth,1))} style={{padding:'8px 12px'}}>
        <ChevronRight size={16}/>
      </button>
    </div>

    {/* Summary Cards */}
    <div className="grid grid-4" style={{gap:14, marginBottom:24}}>
      <div style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius:16, padding:'20px 18px', color:'#fff'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, opacity:.85, fontSize:13, marginBottom:8}}>
          <TrendingUp size={15}/> Monthly Target
        </div>
        <div style={{fontSize:26, fontWeight:900}}>{currency(totalMonthly)}</div>
        <div style={{fontSize:12, opacity:.7, marginTop:4}}>{rows.length} students</div>
      </div>
      <div style={{background:'linear-gradient(135deg,#059669,#10b981)', borderRadius:16, padding:'20px 18px', color:'#fff'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, opacity:.85, fontSize:13, marginBottom:8}}>
          <Wallet size={15}/> Received
        </div>
        <div style={{fontSize:26, fontWeight:900}}>{currency(totalReceived)}</div>
        <div style={{fontSize:12, opacity:.7, marginTop:4}}>{paidCount} fully paid</div>
      </div>
      <div style={{background:'linear-gradient(135deg,#dc2626,#ef4444)', borderRadius:16, padding:'20px 18px', color:'#fff'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, opacity:.85, fontSize:13, marginBottom:8}}>
          <AlertCircle size={15}/> Due
        </div>
        <div style={{fontSize:26, fontWeight:900}}>{currency(totalDue)}</div>
        <div style={{fontSize:12, opacity:.7, marginTop:4}}>{dueCount} students pending</div>
      </div>
      <div style={{background:'linear-gradient(135deg,#0ea5e9,#6366f1)', borderRadius:16, padding:'20px 18px', color:'#fff'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, opacity:.85, fontSize:13, marginBottom:8}}>
          <CheckCircle2 size={15}/> Collection Rate
        </div>
        <div style={{fontSize:26, fontWeight:900}}>{totalMonthly > 0 ? Math.round((totalReceived/totalMonthly)*100) : 0}%</div>
        <div style={{fontSize:12, opacity:.7, marginTop:4}}>of monthly target</div>
      </div>
    </div>

    {/* Progress bar */}
    {totalMonthly > 0 && (
      <div style={{background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 18px', marginBottom:20}}>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:600, marginBottom:8}}>
          <span>Collection Progress</span>
          <span style={{color:'#4f46e5'}}>{currency(totalReceived)} / {currency(totalMonthly)}</span>
        </div>
        <div style={{background:'#f1f5f9', borderRadius:999, height:10, overflow:'hidden'}}>
          <div style={{height:'100%', borderRadius:999, background:'linear-gradient(90deg,#4f46e5,#10b981)', width:`${Math.min(100,(totalReceived/totalMonthly)*100)}%`, transition:'width .5s'}}/>
        </div>
      </div>
    )}

    {/* Student payment table */}
    <div className="card" style={{padding:0, overflow:'hidden'}}>
      <div className="table-responsive">
        <table style={{width:'100%', minWidth:540, borderCollapse:'collapse'}}>
        <thead>
          <tr style={{background:'#f9fafb'}}>
            <th style={th()}>Student</th>
            <th style={th()}>Monthly Fee</th>
            <th style={th()}>Paid ({monthLabel})</th>
            <th style={th()}>Due / Extra</th>
            <th style={th()}>Status</th>
            <th style={th()}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.s.id} style={{borderTop:'1px solid #f1f5f9', background: i%2===0?'#fff':'#fafbfc', transition:'background .15s'}}
              onMouseEnter={e=>(e.currentTarget.style.background='#f5f3ff')}
              onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?'#fff':'#fafbfc')}>
              <td style={td()}>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:36, height:36, borderRadius:10, background:r.s.color||'#4f46e5', color:'#fff', display:'grid', placeItems:'center', fontWeight:800, fontSize:14, flexShrink:0}}>
                    {r.s.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{fontWeight:700}}>{r.s.name}</div>
                    <div style={{fontSize:12, color:'#667085'}}>{r.s.subject}</div>
                  </div>
                </div>
              </td>
              <td style={td()}><span style={{fontWeight:600}}>{currency(r.fee)}</span></td>
              <td style={td()}><span style={{color:'#059669', fontWeight:700}}>{currency(r.paid)}</span></td>
              <td style={td()}>
                <span style={{color: r.due > 0 ? '#dc2626' : '#059669', fontWeight:700}}>
                  {r.overpaid > 0 ? `+${currency(r.overpaid)}` : r.due > 0 ? currency(r.due) : '-'}
                </span>
              </td>
              <td style={td()}>{statusBadge(r)}</td>
              <td style={td()}>
                <button
                  className="btn btn-soft"
                  style={{padding:'6px 12px', fontSize:13, display:'flex', alignItems:'center', gap:6}}
                  onClick={() => setEditModal(r)}
                >
                  <Pencil size={13}/> Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>

    {/* Recent payments */}
    {payments.filter(p => p.month_key === month).length > 0 && (
      <div className="card" style={{marginTop:20}}>
        <h3 className="section-title">Recent Payments — {monthLabel}</h3>
        <div className="list">
          {payments.filter(p => p.month_key === month).slice(0,10).map(p => {
            const s = students.find(x => x.id === p.student_id)
            return (
              <div key={p.id} className="list-item">
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:32, height:32, borderRadius:8, background:s?.color||'#4f46e5', color:'#fff', display:'grid', placeItems:'center', fontWeight:800, fontSize:13}}>
                    {s?.name?.charAt(0)||'?'}
                  </div>
                  <div>
                    <div style={{fontWeight:600}}>{s?.name||'Unknown'}</div>
                    <div style={{fontSize:12, color:'#667085'}}>{p.note||'Payment recorded'}</div>
                  </div>
                </div>
                <div style={{textAlign:'right', display:'flex', alignItems:'center', gap:10}}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => deletePayment(p.id)}
                    title="Delete payment"
                    style={{color:'#dc2626', padding:'5px 8px'}}
                  >
                    <Trash2 size={14}/>
                  </button>
                  <div>
                  <div style={{fontWeight:800, color:'#059669'}}>{currency(Number(p.amount))}</div>
                  <div style={{fontSize:11, color:'#667085'}}>{format(parseISO(p.paid_at), 'd MMM, h:mm a')}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}

    {/* Add payment modal */}
    {addModal && (
      <Modal title="Add Payment" onClose={() => setAddModal(false)}>
        <form action={addPayment} className="form-grid">
          <div className="field">
            <label>Student</label>
            <select className="select" name="student_id">
              {students.filter(s => !s.archived).map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Month</label>
            <input className="input" type="month" name="month_key" defaultValue={month}/>
          </div>
          <div className="field">
            <label>Amount (BDT)</label>
            <input className="input" type="number" name="amount" min="0" required placeholder="0"/>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label>Note</label>
            <textarea className="textarea" name="note" rows={2} placeholder="Optional note…"/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <button className="btn btn-primary" style={{width:'100%', padding:12}}>Save Payment</button>
          </div>
        </form>
      </Modal>
    )}

    {/* Edit student modal */}
    {editModal && (
      <Modal title={`Edit — ${editModal.s.name}`} onClose={() => setEditModal(null)}>
        <form action={saveEdit} className="form-grid">
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label>Monthly Fee (BDT)</label>
            <input className="input" type="number" name="monthly_fee" defaultValue={editModal.s.monthly_fee||0} min="0"/>
          </div>
          <div style={{gridColumn:'1/-1', background:'#f8fafc', borderRadius:10, padding:14}}>
            <div style={{fontWeight:700, fontSize:13, marginBottom:10}}>Record Payment for {monthLabel}</div>
            <div className="field">
              <label>Amount Paid (BDT) — leave 0 to skip</label>
              <input className="input" type="number" name="amount" defaultValue={0} min="0"/>
            </div>
            <div className="field" style={{marginTop:8}}>
              <label>Note</label>
              <input className="input" name="note" placeholder="e.g. Cash paid"/>
            </div>
          </div>
          <div style={{gridColumn:'1/-1', background:'#f0fdf4', borderRadius:10, padding:12, fontSize:13}}>
            <b>Current status:</b> Paid {currency(editModal.paid)} of {currency(editModal.fee)} · Due: {currency(editModal.due)}
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <button className="btn btn-primary" style={{width:'100%', padding:12}}>Save Changes</button>
          </div>
        </form>
      </Modal>
    )}
  </>
}

function th() {
  return {padding:'12px 16px', fontSize:12, color:'#667085', textTransform:'uppercase' as const, letterSpacing:'.04em', fontWeight:700, textAlign:'left' as const}
}
function td() {
  return {padding:'14px 16px', fontSize:14}
}

export default function Page(){return <ProtectedLayout><Payments/></ProtectedLayout>}


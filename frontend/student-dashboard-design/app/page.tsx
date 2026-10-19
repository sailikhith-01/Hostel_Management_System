'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'

type Preference = {
  q1_bedtime: number
  q2_wakeup: number
  q3_tidiness: number
  q4_study_style: string
  q5_study_hours: number
  q6_food: string
  q7_noise_tolerance: number
  q8_visitors_social: number
  q9_weekends: string
  q10_share_belongings: number
}

type Payment = { payment_id: number; amount: number; paid_on: string; mode: string }
type Fine = {
  fine_id: number
  amount: number
  fine_type: string
  reason: string
  issued_on: string
  due_date: string
  status: string
  payments: Payment[]
}
type Complaint = {
  complaint_id: number
  description: string
  category: string
  priority: string
  status: string
  created_at: string
}
type Records = {
  student: {
    student_id: number
    full_name: string
    email: string
    block_number: string
    room_number: string | null
    capacity: number | null
    bed_label: string | null
  }
  complaints: Complaint[]
  fines: Fine[]
  gate_logs: { log_id: number; direction: string; logged_at: string }[]
}

const emptyPreferences: Preference = {
  q1_bedtime: 2,
  q2_wakeup: 2,
  q3_tidiness: 3,
  q4_study_style: 'library',
  q5_study_hours: 3,
  q6_food: 'veg',
  q7_noise_tolerance: 3,
  q8_visitors_social: 3,
  q9_weekends: 'hostel',
  q10_share_belongings: 3,
}

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const dateTime = (value: string) => new Date(value).toLocaleString()

export default function StudentDashboard() {
  const router = useRouter()
  const [records, setRecords] = useState<Records | null>(null)
  const [preferences, setPreferences] = useState<Preference>(emptyPreferences)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadDashboard() {
    try {
      const session = await api<{ user: { role: string } }>('/api/auth/session')
      if (session.user.role !== 'student') {
        router.replace('/login')
        return
      }
      const [recordData, preferenceData] = await Promise.all([
        api<Records>('/api/students/me/records'),
        api<{ preferences: Preference | null }>('/api/students/me/preferences'),
      ])
      setRecords(recordData)
      if (preferenceData.preferences) setPreferences(preferenceData.preferences)
    } catch (reason) {
      if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
        router.replace('/login')
      } else {
        setError(reason instanceof Error ? reason.message : 'Could not load the student portal')
      }
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [router])

  async function submitComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api('/api/complaints', { method: 'POST', body: JSON.stringify({ description }) })
      setDescription('')
      setNotice('Your complaint was submitted.')
      await loadDashboard()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit the complaint')
    } finally {
      setBusy(false)
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api('/api/students/me/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      })
      setNotice('Roommate preferences saved. Admins can now include you in a matching run.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save preferences')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
      router.replace('/login')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign out')
    }
  }

  const setNumeric = (key: keyof Preference, value: string) => {
    setPreferences((current) => ({ ...current, [key]: Number(value) }))
  }
  const setChoice = (key: keyof Preference, value: string) => {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  if (!records) {
    return <main className="min-h-screen bg-[#f6f9fc] p-8 text-slate-600">{error || 'Loading your student portal…'}</main>
  }

  const outstanding = records.fines
    .filter((fine) => fine.status === 'unpaid')
    .reduce((total, fine) => total + Number(fine.amount), 0)

  return (
    <main className="min-h-screen bg-[#f6f9fc] text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4 px-5">
          <a href="#dashboard" className="text-lg font-bold text-[#173b62]">CampusStay</a>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600" aria-label="Student navigation">
            <a href="#complaints">Complaints</a><a href="#preferences">Roommate preferences</a><a href="#records">Fines &amp; activity</a>
            <button onClick={logout} className="rounded-lg border border-slate-200 px-3 py-2 text-[#173b62]">Sign out</button>
          </nav>
        </div>
      </header>

      <div id="dashboard" className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <section className="rounded-2xl bg-[#173b62] p-6 text-white sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#8fd9d0]">Student portal</p>
          <h1 className="mt-2 text-3xl font-bold">Welcome, {records.student.full_name}</h1>
          <p className="mt-2 text-blue-100">{records.student.email} · Student #{records.student.student_id}</p>
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
            <span>Block {records.student.block_number}</span>
            <span>{records.student.room_number
              ? `Room ${records.student.room_number} · ${records.student.capacity}-sharing · Bed ${records.student.bed_label}`
              : 'No room allocation yet'}</span>
          </div>
        </section>

        {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Outstanding fines</p><p className="mt-2 text-2xl font-bold text-[#173b62]">{currency.format(outstanding)}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Open complaints</p><p className="mt-2 text-2xl font-bold text-[#173b62]">{records.complaints.filter((item) => !['resolved', 'rejected'].includes(item.status)).length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Gate logs shown</p><p className="mt-2 text-2xl font-bold text-[#173b62]">{records.gate_logs.length}</p></div>
        </section>

        <section id="preferences" className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-[#173b62]">Roommate preference onboarding</h2>
          <p className="mt-1 text-sm text-slate-500">Complete your preferences before admins run the clustering and room allocation process.</p>
          <form onSubmit={savePreferences} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField label="Bedtime" value={preferences.q1_bedtime} options={['1 · Before 10 PM', '2 · 10–11 PM', '3 · 11 PM–midnight', '4 · After midnight']} onChange={(value) => setNumeric('q1_bedtime', value)} />
            <SelectField label="Wake-up time" value={preferences.q2_wakeup} options={['1 · Before 6 AM', '2 · 6–7 AM', '3 · 7–8 AM', '4 · After 8 AM']} onChange={(value) => setNumeric('q2_wakeup', value)} />
            <SelectField label="Tidiness (1–5)" value={preferences.q3_tidiness} options={['1', '2', '3', '4', '5']} onChange={(value) => setNumeric('q3_tidiness', value)} />
            <SelectField label="Study style" value={preferences.q4_study_style} options={['silent', 'music', 'group', 'library']} onChange={(value) => setChoice('q4_study_style', value)} />
            <SelectField label="Study hours per day (1–4)" value={preferences.q5_study_hours} options={['1', '2', '3', '4']} onChange={(value) => setNumeric('q5_study_hours', value)} />
            <SelectField label="Food preference" value={preferences.q6_food} options={['veg', 'nonveg', 'egg']} onChange={(value) => setChoice('q6_food', value)} />
            <SelectField label="Noise tolerance (1–5)" value={preferences.q7_noise_tolerance} options={['1', '2', '3', '4', '5']} onChange={(value) => setNumeric('q7_noise_tolerance', value)} />
            <SelectField label="Visitors/social activity (1–5)" value={preferences.q8_visitors_social} options={['1', '2', '3', '4', '5']} onChange={(value) => setNumeric('q8_visitors_social', value)} />
            <SelectField label="Weekends" value={preferences.q9_weekends} options={['hostel', 'home', 'out']} onChange={(value) => setChoice('q9_weekends', value)} />
            <SelectField label="Sharing belongings (1–5)" value={preferences.q10_share_belongings} options={['1', '2', '3', '4', '5']} onChange={(value) => setNumeric('q10_share_belongings', value)} />
            <button disabled={busy} className="self-end rounded-lg bg-[#173b62] px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save preferences'}</button>
          </form>
        </section>

        <section id="complaints" className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_1.2fr]">
          <form onSubmit={submitComplaint} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-[#173b62]">Raise a complaint</h2>
            <label htmlFor="description" className="mt-4 block text-sm font-semibold text-slate-700">Describe the issue</label>
            <textarea id="description" required maxLength={5000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
            <button disabled={busy} className="mt-3 rounded-lg bg-[#173b62] px-4 py-2.5 font-bold text-white disabled:opacity-60">{busy ? 'Submitting…' : 'Submit complaint'}</button>
          </form>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-[#173b62]">My complaints</h2>
            <div className="mt-4 space-y-3">
              {records.complaints.length === 0 && <p className="text-sm text-slate-500">No complaints submitted.</p>}
              {records.complaints.map((complaint) => (
                <article key={complaint.complaint_id} className="rounded-lg border border-slate-100 p-4">
                  <div className="flex flex-wrap justify-between gap-2"><strong>#{complaint.complaint_id} · {complaint.category}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{complaint.status.replace('_', ' ')}</span></div>
                  <p className="mt-2 text-sm text-slate-700">{complaint.description}</p>
                  <p className="mt-2 text-xs text-slate-500">{complaint.priority} priority · {dateTime(complaint.created_at)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="records" className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-[#173b62]">Fine &amp; payment history</h2>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Fine</th><th className="py-2">Amount</th><th className="py-2">Status / due</th><th className="py-2">Payments</th></tr></thead>
              <tbody>{records.fines.map((fine) => <tr key={fine.fine_id} className="border-b align-top"><td className="py-3 pr-3">{fine.fine_type}<p className="text-xs text-slate-500">{fine.reason}</p></td><td className="py-3 pr-3">{currency.format(Number(fine.amount))}</td><td className="py-3 pr-3">{fine.status}<p className="text-xs text-slate-500">Due {fine.due_date}</p></td><td className="py-3">{fine.payments.map((payment) => <p key={payment.payment_id}>{currency.format(Number(payment.amount))} · {payment.mode} · {dateTime(payment.paid_on)}</p>)}</td></tr>)}</tbody>
            </table></div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-[#173b62]">Gate history</h2>
            <div className="mt-4 space-y-2">{records.gate_logs.map((log) => <div key={log.log_id} className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm"><span>{log.direction === 'IN' ? 'Entry' : 'Exit'}</span><time className="text-slate-500">{dateTime(log.logged_at)}</time></div>)}{records.gate_logs.length === 0 && <p className="text-sm text-slate-500">No gate logs recorded.</p>}</div>
          </div>
        </section>
      </div>
    </main>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string | number; options: string[]; onChange: (value: string) => void }) {
  const values = options.map((option) => option.split(' · ')[0])
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select value={String(value)} onChange={(event) => onChange(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
        {options.map((option, index) => <option key={option} value={values[index]}>{option}</option>)}
      </select>
    </label>
  )
}

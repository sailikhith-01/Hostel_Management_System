'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'

type Complaint = {
  complaint_id: number
  student_id: number
  full_name: string
  email: string
  room_number: string
  block_number: string
  description: string
  category: string
  priority: string
  confidence: number
  status: string
  created_at: string
}
type RiskReport = {
  student_id: number
  full_name: string
  email: string
  block_number: string
  probability: number
  risk_band: string
  features: {
    fines_3m: number
    amount_3m: number
    distinct_types_3m: number
    unpaid_count: number
    unpaid_amount: number
    avg_days_to_pay: number
  }
}
type DashboardData = {
  summary: {
    students: number
    allocated_students: number
    beds: number
    open_complaints: number
    paid_amount: number
  }
  reports: RiskReport[]
  records: {
    fines: { fine_id: number; student_id: number; full_name: string; amount: number; reason: string; issued_on: string; status: string }[]
    gate_logs: { log_id: number; student_id: number; full_name: string; direction: string; logged_at: string }[]
    payments: { payment_id: number; student_id: number; full_name: string; amount: number; paid_on: string; mode: string; reason: string }[]
  }
}

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const statuses = ['pending', 'in_progress', 'resolved', 'rejected']
const PAGE_SIZE = 10

export default function AdminDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [complaintFilter, setComplaintFilter] = useState('')
  const [complaintSearch, setComplaintSearch] = useState('')
  const [complaintPage, setComplaintPage] = useState(1)

  const [riskSearch, setRiskSearch] = useState('')
  const [riskPage, setRiskPage] = useState(1)

  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState('')
  const [busyComplaint, setBusyComplaint] = useState<number | null>(null)

  const loadDashboard = useCallback(async () => {
    const [summary, riskResult, records] = await Promise.all([
      api<{ summary: DashboardData['summary'] }>('/api/admin/summary'),
      api<{ reports: RiskReport[] }>('/api/admin/fine-risk'),
      api<DashboardData['records']>('/api/admin/records'),
    ])
    setData({
      summary: summary.summary,
      reports: riskResult.reports,
      records,
    })
  }, [])

  const loadComplaints = useCallback(async (filter: string) => {
    const result = await api<{ complaints: Complaint[] }>(
      `/api/admin/complaints${filter ? `?status=${filter}` : ''}`,
    )
    setComplaints(result.complaints)
  }, [])

  useEffect(() => {
    async function initialize() {
      try {
        const session = await api<{ user: { role: string } }>('/api/auth/session')
        if (session.user.role !== 'admin') {
          router.replace('/login')
          return
        }
        setAuthorized(true)
        await loadDashboard()
      } catch (reason) {
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
          router.replace('/login')
        } else {
          setError(reason instanceof Error ? reason.message : 'Could not load admin data')
        }
      }
    }
    void initialize()
  }, [loadDashboard, router])

  useEffect(() => {
    if (!authorized) return
    void loadComplaints(complaintFilter).catch((reason: unknown) => {
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace('/login')
      } else {
        setError(reason instanceof Error ? reason.message : 'Could not load complaints')
      }
    })
  }, [authorized, complaintFilter, loadComplaints, router])

  async function updateStatus(complaintId: number, status: string) {
    setBusyComplaint(complaintId)
    setError('')
    try {
      await api(`/api/admin/complaints/${complaintId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      await loadComplaints(complaintFilter)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update complaint status')
    } finally {
      setBusyComplaint(null)
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

  // Filtered & Paginated Complaints
  const filteredComplaints = useMemo(() => {
    if (!complaintSearch.trim()) return complaints
    const q = complaintSearch.toLowerCase()
    return complaints.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.block_number.toLowerCase().includes(q) ||
        c.room_number.toLowerCase().includes(q),
    )
  }, [complaints, complaintSearch])

  const paginatedComplaints = useMemo(() => {
    const start = (complaintPage - 1) * PAGE_SIZE
    return filteredComplaints.slice(start, start + PAGE_SIZE)
  }, [filteredComplaints, complaintPage])

  const totalComplaintPages = Math.max(1, Math.ceil(filteredComplaints.length / PAGE_SIZE))

  // Filtered & Paginated Fine Risk Reports
  const sortedRiskReports = useMemo(() => {
    if (!data) return []
    const list = [...data.reports].sort((left, right) => right.probability - left.probability)
    if (!riskSearch.trim()) return list
    const q = riskSearch.toLowerCase()
    return list.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.block_number.toLowerCase().includes(q) ||
        r.risk_band.toLowerCase().includes(q),
    )
  }, [data, riskSearch])

  const paginatedRiskReports = useMemo(() => {
    const start = (riskPage - 1) * PAGE_SIZE
    return sortedRiskReports.slice(start, start + PAGE_SIZE)
  }, [sortedRiskReports, riskPage])

  const totalRiskPages = Math.max(1, Math.ceil(sortedRiskReports.length / PAGE_SIZE))

  if (!data) {
    return <main className="min-h-screen bg-[#f5f7fb] p-8 text-slate-600">{error || 'Loading admin dashboard…'}</main>
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-5">
          <a href="#dashboard" className="text-lg font-bold text-[#183b61]">CampusStay Admin</a>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600" aria-label="Admin navigation">
            <a href="#complaints">Complaints</a><a href="#risk">Fine risk</a><a href="#records">Records</a>
            <a href={process.env.NEXT_PUBLIC_MATCHING_URL || 'http://localhost:3001'} className="text-[#16847e]">Roommate matching</a>
            <button onClick={logout} className="rounded-lg border border-slate-200 px-3 py-2 text-[#183b61]">Sign out</button>
          </nav>
        </div>
      </header>

      <div id="dashboard" className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#16847e]">Operations overview</p>
          <h1 className="mt-2 text-3xl font-bold text-[#183b61]">Admin command center</h1>
          <p className="mt-2 text-sm text-slate-500">Live records from the hostel database and fine-risk service.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Hostel summary">
          <Summary label="Students" value={data.summary.students} />
          <Summary label="Allocated students / beds" value={`${data.summary.allocated_students} / ${data.summary.beds}`} />
          <Summary label="Open complaints" value={data.summary.open_complaints} />
          <Summary label="Fine payments received" value={currency.format(Number(data.summary.paid_amount))} />
        </section>

        {/* Complaints Section */}
        <section id="complaints" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-xl font-bold text-[#183b61]">
                Complaints review ({filteredComplaints.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">Filter, inspect, and update complaint status.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search complaints…"
                value={complaintSearch}
                onChange={(e) => {
                  setComplaintSearch(e.target.value)
                  setComplaintPage(1)
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400"
              />
              <label className="text-sm font-semibold text-slate-700">
                Status filter
                <select
                  value={complaintFilter}
                  onChange={(event) => {
                    setComplaintFilter(event.target.value)
                    setComplaintPage(1)
                  }}
                  className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Student / room</th>
                  <th className="p-3">Complaint</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Update</th>
                </tr>
              </thead>
              <tbody>
                {paginatedComplaints.map((complaint) => (
                  <tr key={complaint.complaint_id} className="border-t border-slate-100 align-top">
                    <td className="p-3 font-semibold">
                      {complaint.full_name}
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        {complaint.email} · Block {complaint.block_number}, Room {complaint.room_number}
                      </p>
                    </td>
                    <td className="max-w-sm p-3">{complaint.description}</td>
                    <td className="p-3">
                      {complaint.category}
                      <p className="mt-1 text-xs text-slate-500">
                        {complaint.priority} · confidence {Number(complaint.confidence).toFixed(2)}
                      </p>
                    </td>
                    <td className="p-3">{new Date(complaint.created_at).toLocaleString()}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">
                        {complaint.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      <select
                        aria-label={`Update complaint ${complaint.complaint_id}`}
                        disabled={busyComplaint === complaint.complaint_id}
                        value={complaint.status}
                        onChange={(event) => void updateStatus(complaint.complaint_id, event.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredComplaints.length && <p className="p-6 text-sm text-slate-500">No complaints match this filter.</p>}
          </div>
          {totalComplaintPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
              <span>
                Page {complaintPage} of {totalComplaintPages} ({filteredComplaints.length} complaints)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={complaintPage <= 1}
                  onClick={() => setComplaintPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={complaintPage >= totalComplaintPages}
                  onClick={() => setComplaintPage((p) => Math.min(totalComplaintPages, p + 1))}
                  className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Fine Risk Report Section */}
        <section id="risk" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-xl font-bold text-[#183b61]">
                Complete fine-risk report ({sortedRiskReports.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Every student, prediction probability, risk band, and all six model input features.
              </p>
            </div>
            <input
              type="text"
              placeholder="Search by student, email, block, or risk band…"
              value={riskSearch}
              onChange={(e) => {
                setRiskSearch(e.target.value)
                setRiskPage(1)
              }}
              className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Risk</th>
                  <th className="p-3">Probability</th>
                  <th className="p-3">Fines (3m)</th>
                  <th className="p-3">Issued (3m)</th>
                  <th className="p-3">Types</th>
                  <th className="p-3">Unpaid count</th>
                  <th className="p-3">Unpaid amount</th>
                  <th className="p-3">Avg days to pay</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRiskReports.map((report) => (
                  <tr key={report.student_id} className="border-t border-slate-100">
                    <td className="p-3 font-semibold">
                      {report.full_name}
                      <p className="text-xs font-normal text-slate-500">
                        {report.email} · Block {report.block_number} · #{report.student_id}
                      </p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          report.risk_band === 'High'
                            ? 'bg-rose-100 text-rose-700'
                            : report.risk_band === 'Medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {report.risk_band}
                      </span>
                    </td>
                    <td className="p-3">{(report.probability * 100).toFixed(1)}%</td>
                    <td className="p-3">{report.features.fines_3m}</td>
                    <td className="p-3">{currency.format(report.features.amount_3m)}</td>
                    <td className="p-3">{report.features.distinct_types_3m}</td>
                    <td className="p-3">{report.features.unpaid_count}</td>
                    <td className="p-3">{currency.format(report.features.unpaid_amount)}</td>
                    <td className="p-3">{Number(report.features.avg_days_to_pay).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sortedRiskReports.length && <p className="p-6 text-sm text-slate-500">No student risk records match.</p>}
          </div>
          {totalRiskPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
              <span>
                Page {riskPage} of {totalRiskPages} ({sortedRiskReports.length} records)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={riskPage <= 1}
                  onClick={() => setRiskPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={riskPage >= totalRiskPages}
                  onClick={() => setRiskPage((p) => Math.min(totalRiskPages, p + 1))}
                  className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Records Section */}
        <section id="records" className="grid gap-6 xl:grid-cols-3">
          <RecordTable
            title="Fine records"
            headers={['Student', 'Reason', 'Amount', 'Status']}
            rows={data.records.fines.map((fine) => [
              fine.full_name,
              fine.reason,
              currency.format(Number(fine.amount)),
              fine.status,
            ])}
          />
          <RecordTable
            title="Gate logs"
            headers={['Student', 'Direction', 'Logged at']}
            rows={data.records.gate_logs.map((log) => [
              log.full_name,
              log.direction,
              new Date(log.logged_at).toLocaleString(),
            ])}
          />
          <RecordTable
            title="Payment history"
            headers={['Student', 'Payment', 'Mode', 'Paid at']}
            rows={data.records.payments.map((payment) => [
              payment.full_name,
              `${currency.format(Number(payment.amount))} · ${payment.reason}`,
              payment.mode,
              new Date(payment.paid_on).toLocaleString(),
            ])}
          />
        </section>
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#183b61]">{value}</p>
    </div>
  )
}

function RecordTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page])

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <h2 className="font-bold text-[#183b61]">
          {title} ({rows.length})
        </h2>
        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>
              {page}/{totalPages}
            </span>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-200 px-1.5 py-0.5 disabled:opacity-40"
            >
              ‹
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-slate-200 px-1.5 py-0.5 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </div>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full min-w-[380px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="p-2">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <tr key={`${title}-${index}`} className="border-t border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={`${cellIndex}`} className="max-w-52 p-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-4 text-sm text-slate-500">No records available.</p>}
      </div>
    </div>
  )
}

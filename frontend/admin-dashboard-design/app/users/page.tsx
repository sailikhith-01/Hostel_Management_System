'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError, api } from '@/lib/api'

type StudentForm = {
  full_name: string
  email: string
  roll_number: string
  gender: string
  block_number: string
  room_preference: number
  password: string
}

type AdminForm = {
  full_name: string
  username: string
  email: string
  role: string
  hostel_type: string
  password: string
}
type ManagedAdmin = {
  admin_id: number
  username: string
  email: string | null
  full_name: string
  role: 'WARDEN' | 'SUPER_ADMIN'
  hostel_type: 'all' | 'mens' | 'ladies' | 'unassigned'
}

const emptyStudent: StudentForm = {
  full_name: '',
  email: '',
  roll_number: '',
  gender: 'M',
  block_number: 'A',
  room_preference: 4,
  password: '',
}

const emptyAdmin: AdminForm = {
  full_name: '',
  username: '',
  email: '',
  role: 'WARDEN',
  hostel_type: 'mens',
  password: '',
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900'

export default function UserManagementPage() {
  const router = useRouter()
  const [kind, setKind] = useState<'student' | 'admin'>('student')
  const [student, setStudent] = useState(emptyStudent)
  const [admin, setAdmin] = useState(emptyAdmin)
  const [managedAdmins, setManagedAdmins] = useState<ManagedAdmin[]>([])
  const [adminRole, setAdminRole] = useState('')
  const [hostelType, setHostelType] = useState('unassigned')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function updateAdminHostelType(adminId: number, selectedHostelType: ManagedAdmin['hostel_type']) {
    setError('')
    setNotice('')
    try {
      const result = await api<{ admin: ManagedAdmin }>(`/api/admins/${adminId}/hostel-type`, {
        method: 'PATCH',
        body: JSON.stringify({ hostel_type: selectedHostelType }),
      })
      setManagedAdmins((current) => current.map((managed) =>
        managed.admin_id === adminId ? result.admin : managed))
      setNotice(`Hostel access updated for ${result.admin.full_name}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update admin hostel access')
    }
  }

  useEffect(() => {
    api<{ user: { role: string; admin_role?: string; hostel_type?: string } }>('/api/auth/session')
      .then((session) => {
        if (session.user.role !== 'admin') {
          router.replace('/login')
          return
        }
        setAdminRole(session.user.admin_role || 'WARDEN')
        setHostelType(session.user.hostel_type || 'unassigned')
        if (session.user.hostel_type === 'mens' || session.user.hostel_type === 'ladies') {
          setStudent((current) => ({
            ...current,
            gender: session.user.hostel_type === 'mens' ? 'M' : 'F',
            block_number: 'A',
          }))
        }
        if (session.user.admin_role === 'SUPER_ADMIN') {
          api<{ admins: ManagedAdmin[] }>('/api/admins')
            .then((result) => setManagedAdmins(result.admins))
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'Could not load admin accounts')
            })
        }
      })
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
          router.replace('/login')
        } else {
          setError(reason instanceof Error ? reason.message : 'Could not verify admin access')
        }
      })
  }, [router])

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api<{ student: { name: string; email: string } }>('/api/students', {
        method: 'POST',
        body: JSON.stringify(student),
      })
      setNotice(`Student ${result.student.name} (${result.student.email}) was created.`)
      setStudent({
        ...emptyStudent,
        gender: hostelType === 'ladies' ? 'F' : 'M',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the student account')
    } finally {
      setBusy(false)
    }
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api<{ admin: { username: string; email: string } }>('/api/admins', {
        method: 'POST',
        body: JSON.stringify(admin),
      })
      setNotice(`Admin ${result.admin.username} (${result.admin.email}) was created.`)
      setAdmin(emptyAdmin)
      const resultList = await api<{ admins: ManagedAdmin[] }>('/api/admins')
      setManagedAdmins(resultList.admins)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the admin account')
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

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-5xl items-center justify-between px-5">
          <a href="/" className="text-lg font-bold text-[#183b61]">CampusStay Admin</a>
          <nav className="flex items-center gap-4 text-sm font-semibold text-slate-600" aria-label="Admin navigation">
            <a href="/">Dashboard</a>
            <button onClick={logout} className="rounded-lg border border-slate-200 px-3 py-2 text-[#183b61]">Sign out</button>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#16847e]">Accounts</p>
          <h1 className="mt-2 text-3xl font-bold text-[#183b61]">User Management</h1>
          <p className="mt-2 text-sm text-slate-500">Register students and provision admin access.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex border-b border-slate-100 p-4" role="tablist" aria-label="Account type">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'student'}
              onClick={() => { setKind('student'); setError(''); setNotice('') }}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${kind === 'student' ? 'bg-[#183b61] text-white' : 'text-slate-600'}`}
            >
              New student
            </button>
            {adminRole === 'SUPER_ADMIN' && <button
              type="button"
              role="tab"
              aria-selected={kind === 'admin'}
              onClick={() => { setKind('admin'); setError(''); setNotice('') }}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${kind === 'admin' ? 'bg-[#183b61] text-white' : 'text-slate-600'}`}
            >
              Admin accounts
            </button>}
          </div>

          {kind === 'student' ? (
            <form onSubmit={createStudent} className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Full name
                <input required maxLength={100} autoComplete="name" value={student.full_name} onChange={(event) => setStudent({ ...student, full_name: event.target.value })} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Email
                <input required type="email" maxLength={100} autoComplete="email" value={student.email} onChange={(event) => setStudent({ ...student, email: event.target.value })} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Roll number
                <input required maxLength={50} value={student.roll_number} onChange={(event) => setStudent({ ...student, roll_number: event.target.value })} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Gender
                <select disabled={hostelType === 'mens' || hostelType === 'ladies'} value={student.gender} onChange={(event) => setStudent({ ...student, gender: event.target.value, block_number: 'A' })} className={inputClass}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Block
                <select value={student.block_number} onChange={(event) => setStudent({ ...student, block_number: event.target.value })} className={inputClass}>
                  {(student.gender === 'M' ? 'ABCDEFGHIJKLMNOPQRST'.split('') : [...'ABCDEFGHI', 'S']).map((block) => (
                    <option key={block} value={block}>{block}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Room preference
                <select value={student.room_preference} onChange={(event) => setStudent({ ...student, room_preference: Number(event.target.value) })} className={inputClass}>
                  {[1, 2, 3, 4, 6, 8].map((capacity) => (
                    <option key={capacity} value={capacity}>{capacity}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Initial password
                <input required type="password" minLength={8} maxLength={255} autoComplete="new-password" value={student.password} onChange={(event) => setStudent({ ...student, password: event.target.value })} className={inputClass} />
              </label>
              <button disabled={busy || hostelType === 'unassigned'} className="rounded-lg bg-[#183b61] px-4 py-3 font-bold text-white disabled:opacity-60 sm:col-span-2">
                {busy ? 'Creating…' : 'Create student'}
              </button>
            </form>
          ) : (
            <form onSubmit={createAdmin} className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Full name
                <input required maxLength={100} autoComplete="name" value={admin.full_name} onChange={(event) => setAdmin({ ...admin, full_name: event.target.value })} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Username
                <input required maxLength={50} autoComplete="username" value={admin.username} onChange={(event) => setAdmin({ ...admin, username: event.target.value })} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Email
                <input required type="email" maxLength={100} autoComplete="email" value={admin.email} onChange={(event) => setAdmin({ ...admin, email: event.target.value })} className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-slate-700">Role
                <select value={admin.role} onChange={(event) => setAdmin({
                  ...admin,
                  role: event.target.value,
                  hostel_type: event.target.value === 'SUPER_ADMIN' ? 'all' : 'mens',
                })} className={inputClass}>
                  <option value="WARDEN">Warden</option>
                  <option value="SUPER_ADMIN">Super admin</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Hostel access
                <select disabled={admin.role === 'SUPER_ADMIN'} value={admin.hostel_type} onChange={(event) => setAdmin({ ...admin, hostel_type: event.target.value })} className={inputClass}>
                  <option value="mens">Men&apos;s Hostel Admin</option>
                  <option value="ladies">Ladies&apos; Hostel Admin</option>
                  {admin.role === 'SUPER_ADMIN' && <option value="all">All hostels</option>}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Password
                <input required type="password" minLength={8} maxLength={255} autoComplete="new-password" value={admin.password} onChange={(event) => setAdmin({ ...admin, password: event.target.value })} className={inputClass} />
              </label>
              <button disabled={busy} className="rounded-lg bg-[#183b61] px-4 py-3 font-bold text-white disabled:opacity-60 sm:col-span-2">
                {busy ? 'Creating…' : 'Create admin'}
              </button>
            </form>
          )}
        </section>
        {adminRole === 'SUPER_ADMIN' && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-4 text-lg font-bold text-[#183b61]">Admin access assignments</h2>
            <ul className="divide-y divide-slate-100">
              {managedAdmins.map((managed) => (
                <li key={managed.admin_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{managed.full_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{managed.email || managed.username} · {managed.role.replace('_', ' ')}</p>
                  </div>
                  {managed.role === 'SUPER_ADMIN' ? (
                    <span className="text-sm font-semibold text-[#16847e]">Full hostel access</span>
                  ) : (
                    <select
                      aria-label={`Hostel assignment for ${managed.full_name}`}
                      value={managed.hostel_type}
                      onChange={(event) => void updateAdminHostelType(managed.admin_id, event.target.value as ManagedAdmin['hostel_type'])}
                      className={inputClass}
                    >
                      <option value="unassigned">Unassigned</option>
                      <option value="mens">Men&apos;s Hostel Admin</option>
                      <option value="ladies">Ladies&apos; Hostel Admin</option>
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-slate-500">Passwords are hashed before storage. Use development-only credentials and never reuse real passwords.</p>
      </div>
    </main>
  )
}

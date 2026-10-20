'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

type Registration = {
  full_name: string
  email: string
  roll_number: string
  gender: string
  block_number: string
  room_preference: number
  password: string
}

const initialForm: Registration = {
  full_name: '',
  email: '',
  roll_number: '',
  gender: 'M',
  block_number: 'A',
  room_preference: 4,
  password: '',
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      router.replace('/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create your account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f9fc] px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <a href="/login" className="text-sm font-bold text-[#173b62]">CampusStay</a>
        <h1 className="mt-6 text-2xl font-bold text-[#173b62]">Create student account</h1>
        <p className="mt-2 text-sm text-slate-500">Register to access your hostel student portal.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Full name
            <input required maxLength={100} autoComplete="name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">College email
            <input required type="email" maxLength={100} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">Roll number
            <input required maxLength={50} value={form.roll_number} onChange={(event) => setForm({ ...form, roll_number: event.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-slate-700">Gender
            <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value, block_number: 'A' })} className={inputClass}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Block
            <select value={form.block_number} onChange={(event) => setForm({ ...form, block_number: event.target.value })} className={inputClass}>
              {(form.gender === 'M' ? 'ABCDEFGHIJKLMNOPQRST'.split('') : [...'ABCDEFGHI', 'S']).map((block) => (
                <option key={block} value={block}>{block}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Room preference
            <select value={form.room_preference} onChange={(event) => setForm({ ...form, room_preference: Number(event.target.value) })} className={inputClass}>
              {[1, 2, 3, 4, 6, 8].map((capacity) => (
                <option key={capacity} value={capacity}>{capacity}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Password
            <input required type="password" minLength={8} maxLength={255} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={inputClass} />
          </label>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button disabled={busy} className="mt-6 w-full rounded-lg bg-[#173b62] px-4 py-3 font-bold text-white disabled:opacity-60">
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already registered? <a href="/login" className="font-semibold text-[#173b62] underline">Sign in</a>
        </p>
      </form>
    </main>
  )
}

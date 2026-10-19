'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role: 'admin', username: identifier, password }),
      })
      router.replace('/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <a href="/" className="text-sm font-bold text-[#183b61]">CampusStay</a>
        <h1 className="mt-6 text-2xl font-bold text-[#183b61]">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to manage hostel operations and roommate allocation.</p>
        <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="identifier">Username</label>
        <input id="identifier" required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-gray-900 dark:bg-slate-800 dark:text-white" />
        <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
        <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-gray-900 dark:bg-slate-800 dark:text-white" />
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button disabled={busy} className="mt-6 w-full rounded-lg bg-[#183b61] px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  )
}

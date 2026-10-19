'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'

type Group = {
  group_id: number
  cluster_id: number
  capacity: number
  status: string
  room_number: string
  block_number: string
  gender: string
  students: { student_id: number; full_name: string; bed_id: number | null; bed_label: string | null }[]
  compatibility: { student_a: string; student_b: string; similarity: number }[]
}
type MatchState = {
  run: { run_id: number; run_at: string; k: number; silhouette: number | null } | null
  groups: Group[]
  compatibility_threshold: number
}

export default function MatchingDashboard() {
  const router = useRouter()
  const [matchState, setMatchState] = useState<MatchState>({
    run: null,
    groups: [],
    compatibility_threshold: 0.65,
  })
  const [unmatched, setUnmatched] = useState<number[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadLatest = useCallback(async () => {
    setMatchState(await api<MatchState>('/api/admin/matching/latest'))
  }, [])

  useEffect(() => {
    async function initialize() {
      try {
        const session = await api<{ user: { role: string } }>('/api/auth/session')
        if (session.user.role !== 'admin') {
          router.replace('/login')
          return
        }
        await loadLatest()
      } catch (reason) {
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
          router.replace('/login')
        } else {
          setError(reason instanceof Error ? reason.message : 'Could not load matching dashboard')
        }
      } finally {
        setLoading(false)
      }
    }
    void initialize()
  }, [loadLatest, router])

  async function runMatching() {
    setBusy(true)
    setError('')
    setNotice('')
    setUnmatched([])
    try {
      const result = await api<{ run_id: number; groups: Group[]; unmatched_student_ids: number[] }>(
        '/api/admin/matching/run',
        { method: 'POST' },
      )
      setUnmatched(result.unmatched_student_ids)
      await loadLatest()
      setNotice(`Matching run #${result.run_id} completed. Review its compatible groups before allocating.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not run roommate matching')
    } finally {
      setBusy(false)
    }
  }

  async function confirmAllocation() {
    if (!matchState.run) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api<{ allocations_created: number }>(
        `/api/admin/matching/${matchState.run.run_id}/confirm`,
        { method: 'POST' },
      )
      await loadLatest()
      setNotice(`${result.allocations_created} student allocation(s) confirmed.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not confirm the allocation')
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

  if (loading) {
    return <main className="min-h-screen bg-[#f5f7fb] p-8 text-slate-600">Loading matching dashboard…</main>
  }

  const pendingGroups = matchState.groups.some((group) => group.status === 'pending')

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between gap-4 px-5">
          <a href="/" className="text-lg font-bold text-[#183b61]">CampusStay Admin</a>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600" aria-label="Admin navigation">
            <a href={process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000'}>Core dashboard</a><a href="#groups">Matching groups</a>
            <button onClick={logout} className="rounded-lg border border-slate-200 px-3 py-2 text-[#183b61]">Sign out</button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#16847e]">Resident allocation</p><h1 className="mt-2 text-3xl font-bold text-[#183b61]">Roommate matching review</h1><p className="mt-2 text-sm text-slate-500">Only students who submitted preferences are clustered. Every shared group is pairwise compatibility-checked against its room capacity.</p></div>
          <button disabled={busy} onClick={() => void runMatching()} className="rounded-lg bg-[#183b61] px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Working…' : 'Run matching algorithm'}</button>
        </section>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Latest run" value={matchState.run ? `#${matchState.run.run_id}` : 'Not run'} />
          <Metric label="K-Means clusters" value={matchState.run ? matchState.run.k : '—'} />
          <Metric label="Groups awaiting allocation" value={matchState.groups.filter((group) => group.status === 'pending').length} />
        </section>

        <section id="groups" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-bold text-[#183b61]">Compatible room groups</h2><p className="mt-1 text-sm text-slate-500">All pairwise preference scores must meet the {Math.round(matchState.compatibility_threshold * 100)}% server threshold.</p></div>
            {pendingGroups && <button disabled={busy} onClick={() => void confirmAllocation()} className="rounded-lg border border-[#16847e] px-4 py-2.5 font-bold text-[#16847e] disabled:opacity-60">Confirm all safe allocations</button>}
          </div>
          {matchState.groups.map((group) => (
            <article key={group.group_id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap justify-between gap-3 border-b border-slate-100 pb-4">
                <div><h3 className="font-bold text-[#183b61]">Room {group.room_number} · Block {group.block_number}</h3><p className="mt-1 text-sm text-slate-500">{group.students.length} / {group.capacity} occupants · Cluster {group.cluster_id} · {group.gender === 'F' ? 'Women' : 'Men'} room</p></div>
                <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{group.status}</span>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.students.map((student) => <li key={student.student_id} className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold">{student.full_name}</p>
                  <p className="mt-1 text-xs text-slate-500">Student #{student.student_id}{student.bed_label ? ` · Bed ${student.bed_label}` : ''}</p>
                </li>)}
              </ul>
              {group.compatibility.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {group.compatibility.map((pair) => <p key={`${pair.student_a}-${pair.student_b}`}>{pair.student_a} ↔ {pair.student_b}: {(Number(pair.similarity) * 100).toFixed(1)}% compatible</p>)}
              </div>}
            </article>
          ))}
          {!matchState.groups.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No matching groups yet. Students must complete roommate onboarding, and eligible empty rooms must be available.</div>}
          {unmatched.length > 0 && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Not allocated because no safe compatible room was available: {unmatched.map((id) => `#${id}`).join(', ')}. They remain unallocated for a later run.</p>}
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-[#183b61]">{value}</p></div>
}

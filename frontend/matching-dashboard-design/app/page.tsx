'use client'

import { useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  Cpu,
  LayoutDashboard,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Match = {
  id: string
  studentA: string
  idA: string
  studentB: string
  idB: string
  score: number
  status: 'Optimal Match' | 'Needs Review - Low Similarity'
}

const initialMatches: Match[] = [
  { id: '1', studentA: 'Aarav Mehta', idA: 'CS24A102', studentB: 'Maya Patel', idB: 'DS23B047', score: 88, status: 'Optimal Match' },
  { id: '2', studentA: 'Rohan Iyer', idA: 'EE24A018', studentB: 'Zoya Khan', idB: 'ME23C091', score: 76, status: 'Optimal Match' },
  { id: '3', studentA: 'Nikhil Rao', idA: 'IT24B063', studentB: 'Ishita Shah', idB: 'BA24A029', score: 51, status: 'Needs Review - Low Similarity' },
  { id: '4', studentA: 'Kabir Singh', idA: 'EC23B114', studentB: 'Diya Menon', idB: 'AR24C008', score: 42, status: 'Needs Review - Low Similarity' },
]

export default function Page() {
  const [matches, setMatches] = useState(initialMatches)
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const runAlgorithm = () => {
    setRunning(true)
    window.setTimeout(() => setRunning(false), 900)
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1380px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-10">
            <a href="#top" className="flex items-center gap-3" aria-label="CampusStay home">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#183b61] text-white"><LayoutDashboard aria-hidden="true" /></span>
              <span className="text-[17px] font-bold tracking-[-0.03em] text-[#183b61]">CampusStay</span>
            </a>
            <nav className="hidden items-center gap-7 text-[13px] font-semibold text-slate-400 md:flex" aria-label="Main navigation">
              <a href="#matching" className="text-[#183b61]">Roommate matching</a><a href="#metrics" className="hover:text-[#183b61]">Model metrics</a><a href="#history" className="hover:text-[#183b61]">Match history</a>
            </nav>
          </div>
          <button className="flex items-center gap-2.5 rounded-lg text-left" aria-label="Open profile menu"><span className="flex size-9 items-center justify-center rounded-full bg-[#dce9f5] text-xs font-bold text-[#183b61]">AN</span><span className="hidden leading-tight sm:block"><span className="block text-[13px] font-semibold text-slate-800">Anita Nair</span><span className="block text-[11px] text-slate-400">Warden · Block A–C</span></span><ChevronDown className="text-slate-400" aria-hidden="true" /></button>
        </div>
      </header>

      <div id="matching" className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#16847e]">Resident allocation</p><h1 className="text-3xl font-bold tracking-[-0.045em] text-[#183b61] sm:text-[38px]">Roommate matching review</h1><p className="mt-2 text-[15px] text-slate-500">Review model suggestions before allocating shared rooms.</p></div>
          <Button onClick={runAlgorithm} disabled={running} className="h-11 rounded-xl bg-[#183b61] px-5 font-bold shadow-[0_6px_14px_rgba(24,59,97,0.18)] hover:bg-[#102e4c]">{running ? <RefreshCw data-icon="inline-start" className="animate-spin" /> : <Play data-icon="inline-start" />} {running ? 'Running algorithm…' : 'Run matching algorithm'}</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_286px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(31,55,80,0.035)]" aria-labelledby="suggestions-title">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><Sparkles className="text-[#16847e]" aria-hidden="true" /><h2 id="suggestions-title" className="text-lg font-bold tracking-[-0.03em] text-[#183b61]">Suggested pairs</h2></div><p className="mt-1 text-xs text-slate-400">Generated from the latest questionnaire responses.</p></div><span className="rounded-full bg-[#e8f7f5] px-3 py-1.5 text-[11px] font-bold text-[#16847e]">{matches.length} suggestions ready</span></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50/80"><tr className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-3.5">Student A</th><th className="px-4 py-3.5">Student B</th><th className="px-4 py-3.5">Compatibility</th><th className="px-4 py-3.5">Status</th><th className="px-6 py-3.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{matches.map((match) => { const isConfirmed = confirmed.includes(match.id); return <tr key={match.id} className="text-sm hover:bg-slate-50/60"><td className="px-6 py-4"><Student name={match.studentA} id={match.idA} /></td><td className="px-4 py-4"><Student name={match.studentB} id={match.idB} /></td><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="text-lg font-bold tracking-[-0.03em] text-[#183b61]">{match.score}%</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${match.score >= 70 ? 'bg-[#16847e]' : 'bg-amber-400'}`} style={{ width: `${match.score}%` }} /></span></div></td><td className="px-4 py-4"><span className={`inline-flex max-w-[170px] rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 ring-1 ring-inset ${match.status === 'Optimal Match' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' : 'bg-amber-50 text-amber-700 ring-amber-600/10'}`}>{match.status}</span></td><td className="px-6 py-4 text-right"><Button size="sm" variant={isConfirmed ? 'secondary' : 'outline'} disabled={isConfirmed} onClick={() => setConfirmed((items) => [...items, match.id])} className="text-xs font-bold">{isConfirmed ? <><Check data-icon="inline-start" /> Allocated</> : 'Confirm match'}</Button></td></tr> })}</tbody></table></div>
          </section>

          <aside id="metrics" className="flex flex-col gap-4"><div className="rounded-2xl bg-[#183b61] p-6 text-white shadow-[0_8px_24px_rgba(24,59,97,0.16)]"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#83d4ce]">Model health</p><h2 className="mt-2 text-xl font-bold tracking-[-0.03em]">Clustering metrics</h2></div><span className="flex size-10 items-center justify-center rounded-xl bg-white/10"><Cpu aria-hidden="true" /></span></div><Metric label="Silhouette score" value="0.65" detail="Good cluster separation" /><Metric label="ARI" value="0.72" detail="Strong agreement" /><div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-xs font-semibold text-[#b8c9d9]"><Activity aria-hidden="true" /> Last evaluated today, 06:00 AM</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-[#e8f7f5] text-[#16847e]"><ShieldCheck aria-hidden="true" /></span><div><p className="text-sm font-bold text-[#183b61]">Allocation safeguards</p><p className="mt-1 text-xs leading-5 text-slate-400">Confirmed matches are written to the room allocation queue.</p></div></div></div></aside>
        </div>
        <footer className="mt-6 flex items-center gap-2 text-xs text-slate-400"><Users aria-hidden="true" /> Questionnaire model v2.4 · 184 residents analyzed</footer>
      </div>
    </main>
  )
}

function Student({ name, id }: { name: string; id: string }) { return <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-[#e7eef6] text-xs font-bold text-[#183b61]">{name.split(' ').map((part) => part[0]).join('')}</span><div><p className="font-bold text-slate-700">{name}</p><p className="mt-0.5 text-[11px] text-slate-400">{id}</p></div></div> }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="border-t border-white/10 py-4 first:border-t-0 first:pt-0"><div className="flex items-end justify-between"><p className="text-sm font-semibold text-[#b8c9d9]">{label}</p><p className="text-3xl font-bold tracking-[-0.05em]">{value}</p></div><p className="mt-1 text-xs text-[#83d4ce]">{detail}</p></div> }

'use client'

import { useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

type Match = {
  id: number
  studentA: string
  studentB: string
  score: number
  status: 'Optimal Match' | 'Needs Review - Low Similarity'
  initialsA: string
  initialsB: string
}

const initialMatches: Match[] = [
  { id: 1, studentA: 'Aarav Mehta', studentB: 'Riya Sharma', score: 88, status: 'Optimal Match', initialsA: 'AM', initialsB: 'RS' },
  { id: 2, studentA: 'Noah Johnson', studentB: 'Ethan Williams', score: 84, status: 'Optimal Match', initialsA: 'NJ', initialsB: 'EW' },
  { id: 3, studentA: 'Sofia Garcia', studentB: 'Maya Patel', score: 61, status: 'Needs Review - Low Similarity', initialsA: 'SG', initialsB: 'MP' },
  { id: 4, studentA: 'Liam Chen', studentB: 'Olivia Brown', score: 79, status: 'Optimal Match', initialsA: 'LC', initialsB: 'OB' },
  { id: 5, studentA: 'Emma Wilson', studentB: 'Daniel Kim', score: 54, status: 'Needs Review - Low Similarity', initialsA: 'EW', initialsB: 'DK' },
]

const metrics = [
  { label: 'Silhouette Score', value: '0.65', detail: 'Good cluster separation', icon: Activity },
  { label: 'ARI', value: '0.72', detail: 'Strong label agreement', icon: BrainCircuit },
]

function Avatar({ initials, tone }: { initials: string; tone: 'navy' | 'teal' }) {
  return <span className={`flex size-9 items-center justify-center rounded-full text-[11px] font-bold ${tone === 'navy' ? 'bg-[#e3edf7] text-[#173b62]' : 'bg-[#e0f2ef] text-[#14766e]'}`}>{initials}</span>
}

export default function Page() {
  const [matches, setMatches] = useState(initialMatches)
  const [isRunning, setIsRunning] = useState(false)
  const [confirmed, setConfirmed] = useState<number[]>([])

  function runAlgorithm() {
    setIsRunning(true)
    window.setTimeout(() => setIsRunning(false), 900)
  }

  function confirmMatch(id: number) {
    setConfirmed((current) => current.includes(id) ? current : [...current, id])
  }

  return (
    <main className="min-h-screen bg-[#f5f8fb] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-10">
            <a href="#top" className="flex items-center gap-2.5" aria-label="CampusStay matching center">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#173b62] text-white"><LayoutDashboard aria-hidden="true" /></span>
              <span className="text-[17px] font-bold tracking-[-0.03em] text-[#173b62]">CampusStay</span>
            </a>
            <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-500 md:flex" aria-label="Main navigation">
              <a href="#matching" className="text-[#173b62]">Matching</a><a href="#students" className="hover:text-[#173b62]">Students</a><a href="#reports" className="hover:text-[#173b62]">Reports</a>
            </nav>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:flex"><span className="size-1.5 rounded-full bg-emerald-500" />Model online</span>
            <span className="h-7 w-px bg-slate-200" />
            <button className="flex items-center gap-2.5 rounded-lg py-1 text-left" aria-label="Open profile menu"><span className="flex size-9 items-center justify-center rounded-full bg-[#dce9f5] text-xs font-bold text-[#173b62]">AM</span><span className="hidden leading-tight sm:block"><span className="block text-[13px] font-semibold text-slate-800">Alex Morgan</span><span className="block text-[11px] text-slate-400">Chief Warden</span></span><ChevronDown className="hidden text-slate-400 sm:block" aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <div id="matching" className="mx-auto grid max-w-[1480px] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-12 lg:py-11">
        <section>
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#16847e]">Housing operations · matching lab</p><h1 className="text-3xl font-bold tracking-[-0.04em] text-[#173b62] sm:text-[38px]">Roommate matching review</h1><p className="mt-2 text-[15px] text-slate-500">Review model recommendations before allocating rooms to students.</p></div>
            <Button onClick={runAlgorithm} disabled={isRunning} className="w-fit bg-[#173b62] text-white shadow-sm hover:bg-[#234b76]"><RefreshCw data-icon="inline-start" aria-hidden="true" className={isRunning ? 'animate-spin' : ''} />{isRunning ? 'Running model…' : 'Run Matching Algorithm'}</Button>
          </div>

          <div className="mb-6 flex items-start gap-4 rounded-2xl border border-[#cfe2f3] bg-[#eef7ff] p-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#2c6597] shadow-sm"><Sparkles aria-hidden="true" /></span><div><p className="text-sm font-bold text-[#173b62]">5 new suggestions are ready for review</p><p className="mt-1 text-sm text-slate-500">The latest run analyzed 286 questionnaire responses across Blocks A–D.</p></div><span className="ml-auto hidden items-center gap-1 text-[11px] font-semibold text-[#2c6597] sm:flex"><Clock3 data-icon="inline-start" aria-hidden="true" />Updated 8:42 AM</span></div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(31,55,80,0.03)]"><div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7"><div><div className="mb-1 flex items-center gap-2"><Users className="text-[#16847e]" aria-hidden="true" /><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#16847e]">Allocation queue</p></div><h2 className="text-xl font-bold tracking-[-0.03em] text-[#173b62]">Suggested roommate pairs</h2><p className="mt-1 text-sm text-slate-500">Confirm optimal matches or review low-similarity pairs manually.</p></div><Button variant="outline" className="w-fit border-slate-200 text-slate-600"><SlidersHorizontal data-icon="inline-start" aria-hidden="true" />Filters</Button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-[#f8fafc]"><tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-4 sm:px-7">Student A</th><th className="px-4 py-4">Student B</th><th className="px-4 py-4">Compatibility similarity</th><th className="px-4 py-4">Status</th><th className="px-6 py-4 text-right sm:px-7">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{matches.map((match) => { const isConfirmed = confirmed.includes(match.id); return <tr key={match.id} className="transition-colors hover:bg-slate-50/70"><td className="px-6 py-4 sm:px-7"><div className="flex items-center gap-3"><Avatar initials={match.initialsA} tone="navy" /><span className="text-sm font-semibold text-slate-800">{match.studentA}</span></div></td><td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar initials={match.initialsB} tone="teal" /><span className="text-sm font-semibold text-slate-800">{match.studentB}</span></div></td><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="text-sm font-bold text-[#173b62]">{match.score}%</span><span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${match.score >= 75 ? 'bg-[#16847e]' : 'bg-amber-400'}`} style={{ width: `${match.score}%` }} /></span></div></td><td className="px-4 py-4"><span className={`inline-flex max-w-[190px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${match.status === 'Optimal Match' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-amber-100'}`}><span className="size-1.5 shrink-0 rounded-full bg-current" />{match.status}</span></td><td className="px-6 py-4 text-right sm:px-7"><Button variant={isConfirmed ? 'secondary' : 'outline'} size="sm" disabled={isConfirmed} onClick={() => confirmMatch(match.id)} className={isConfirmed ? 'text-emerald-700' : 'border-[#b8d2e8] text-[#2c6597] hover:bg-blue-50'}>{isConfirmed ? <><Check data-icon="inline-start" aria-hidden="true" />Allocated</> : 'Confirm Match'}</Button></td></tr> })}</tbody></table></div>
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs text-slate-400 sm:px-7"><span>Showing {matches.length} suggestions from the latest model run</span><span className="flex items-center gap-1.5 font-semibold text-[#2c6597]"><Database aria-hidden="true" />Allocation sync enabled</span></div>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_18px_rgba(31,55,80,0.03)] lg:mt-[116px]" aria-label="Clustering metrics"><div className="mb-6 flex items-start justify-between"><div><div className="mb-1 flex items-center gap-2"><BrainCircuit className="text-[#16847e]" aria-hidden="true" /><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#16847e]">Model health</p></div><h2 className="text-lg font-bold tracking-[-0.03em] text-[#173b62]">Clustering metrics</h2></div><button aria-label="About clustering metrics" className="text-slate-400 hover:text-slate-600"><CircleHelp aria-hidden="true" /></button></div><div className="flex flex-col gap-4">{metrics.map((metric) => { const Icon = metric.icon; return <div key={metric.label} className="rounded-xl bg-[#f7fafc] p-4"><div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-lg bg-white text-[#2c6597] shadow-sm"><Icon aria-hidden="true" /></span><span className="text-2xl font-bold tracking-[-0.04em] text-[#173b62]">{metric.value}</span></div><p className="mt-4 text-sm font-semibold text-slate-700">{metric.label}</p><p className="mt-1 text-xs text-slate-400">{metric.detail}</p></div> })}</div><div className="mt-6 border-t border-slate-100 pt-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Current model</p><div className="mt-3 flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">Questionnaire v3.2</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Production</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Last trained on October 14, 2026 using 1,842 historical allocations.</p></div><div className="mt-5 flex items-center gap-2 rounded-lg bg-[#fffaf0] px-3 py-2.5 text-xs text-amber-800"><ShieldCheck aria-hidden="true" />Human review required before allocation.</div></aside>
      </div>
    </main>
  )
}

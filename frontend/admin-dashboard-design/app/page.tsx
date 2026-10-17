'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

type Risk = 'Low' | 'Medium' | 'High'

const students: { name: string; id: string; block: string; fines: number; unpaid: string; score: string; risk: Risk }[] = [
  { name: 'Aarav Mehta', id: 'CS24A102', block: 'A', fines: 0, unpaid: '$0', score: '12%', risk: 'Low' },
  { name: 'Maya Patel', id: 'DS23B047', block: 'B', fines: 1, unpaid: '$25', score: '38%', risk: 'Medium' },
  { name: 'Rohan Iyer', id: 'EE24A018', block: 'A', fines: 3, unpaid: '$120', score: '86%', risk: 'High' },
  { name: 'Zoya Khan', id: 'ME23C091', block: 'C', fines: 2, unpaid: '$75', score: '64%', risk: 'Medium' },
  { name: 'Nikhil Rao', id: 'IT24B063', block: 'B', fines: 0, unpaid: '$0', score: '08%', risk: 'Low' },
]

const riskStyles: Record<Risk, string> = {
  Low: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  High: 'bg-rose-50 text-rose-700 ring-rose-600/10',
}

export default function Page() {
  const [sent, setSent] = useState<string[]>([])

  const sendReminder = (name: string) => {
    setSent((current) => (current.includes(name) ? current : [...current, name]))
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
              <a href="#dashboard" className="text-[#183b61]">Command center</a>
              <a href="#risk" className="hover:text-[#183b61]">Fine risk</a>
              <a href="#complaints" className="hover:text-[#183b61]">Complaints</a>
            </nav>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <button className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-50" aria-label="View notifications"><Bell aria-hidden="true" /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#16847e] ring-2 ring-white" /></button>
            <span className="hidden h-7 w-px bg-slate-200 sm:block" />
            <button className="flex items-center gap-2.5 rounded-lg text-left" aria-label="Open profile menu"><span className="flex size-9 items-center justify-center rounded-full bg-[#dce9f5] text-xs font-bold text-[#183b61]">AN</span><span className="hidden leading-tight sm:block"><span className="block text-[13px] font-semibold text-slate-800">Anita Nair</span><span className="block text-[11px] text-slate-400">Warden · Block A–C</span></span><ChevronDown className="hidden text-slate-400 sm:block" aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <div id="dashboard" className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#16847e]">Operations overview</p><h1 className="text-3xl font-bold tracking-[-0.045em] text-[#183b61] sm:text-[38px]">Warden command center</h1><p className="mt-2 text-[15px] text-slate-500">Stay ahead of resident operations, fine risk, and hostel health.</p></div>
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-400"><span className="size-2 rounded-full bg-emerald-500" />Data refreshed 2 min ago</span>
        </div>

        <section className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-amber-200 bg-[#fffaf0] px-5 py-4 shadow-[0_4px_18px_rgba(111,74,20,0.04)] sm:flex-row sm:items-center" aria-label="Operational alert">
          <div className="flex items-start gap-3"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><AlertTriangle aria-hidden="true" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-amber-950">Spike in Electrical complaints in Block B</p><span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Needs attention</span></div><p className="mt-1 text-xs text-amber-800/70">7 complaints logged in the last 48 hours · SQL view: <span className="font-semibold">vw_complaint_anomalies</span></p></div></div><Button variant="outline" className="border-amber-300 bg-transparent text-xs font-bold text-amber-900 hover:bg-amber-100">Review complaints <ArrowUpRight data-icon="inline-end" /></Button>
        </section>

        <section id="complaints" className="mb-6 grid gap-4 sm:grid-cols-3" aria-label="Summary statistics">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_18px_rgba(31,55,80,0.035)]"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">Total occupancy</p><p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-[#183b61]">842 <span className="text-base font-semibold text-slate-400">/ 900</span></p><p className="mt-1 text-xs font-semibold text-emerald-600">93.6% occupied</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-[#eef7ff] text-[#2c6597]"><Users aria-hidden="true" /></span></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_18px_rgba(31,55,80,0.035)]"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">Fine revenue collected</p><p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-[#183b61]">$12,480</p><p className="mt-1 text-xs font-semibold text-emerald-600">+8.4% this month</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-[#e8f7f5] text-[#16847e]"><DollarSign aria-hidden="true" /></span></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_18px_rgba(31,55,80,0.035)]"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">Pending complaints</p><p className="mt-2 text-3xl font-bold tracking-[-0.05em] text-[#183b61]">24</p><p className="mt-1 text-xs font-semibold text-amber-600">6 high priority</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><MessageSquare aria-hidden="true" /></span></div></div>
        </section>

        <section id="risk" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(31,55,80,0.035)]"><div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><ShieldCheck className="text-[#16847e]" aria-hidden="true" /><h2 className="text-lg font-bold tracking-[-0.03em] text-[#183b61]">Fine-Risk Prediction</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Next month</span></div><p className="mt-1 text-xs text-slate-400">Students most likely to carry an unpaid fine balance.</p></div><button className="flex items-center gap-2 self-start rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50" aria-label="More prediction options"><MoreHorizontal aria-hidden="true" /> Options</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50/80"><tr className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-3.5">Student name</th><th className="px-4 py-3.5">Block</th><th className="px-4 py-3.5">3M fines count</th><th className="px-4 py-3.5">Unpaid amount</th><th className="px-4 py-3.5">Risk score</th><th className="px-6 py-3.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id} className="text-sm hover:bg-slate-50/60"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-[#e7eef6] text-xs font-bold text-[#183b61]">{student.name.split(' ').map((part) => part[0]).join('')}</span><div><p className="font-bold text-slate-700">{student.name}</p><p className="mt-0.5 text-[11px] text-slate-400">{student.id}</p></div></div></td><td className="px-4 py-4 font-semibold text-slate-600">{student.block}</td><td className="px-4 py-4 font-semibold text-slate-600">{student.fines}</td><td className="px-4 py-4 font-semibold text-slate-700">{student.unpaid}</td><td className="px-4 py-4"><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${riskStyles[student.risk]}`}>{student.risk}</span><span className="text-xs font-semibold text-slate-400">{student.score}</span></div></td><td className="px-6 py-4 text-right"><Button size="sm" variant={sent.includes(student.name) ? 'secondary' : 'outline'} disabled={sent.includes(student.name)} onClick={() => sendReminder(student.name)} className="text-xs font-bold">{sent.includes(student.name) ? <><CheckCircle2 data-icon="inline-start" /> Sent</> : <><Send data-icon="inline-start" /> Send reminder</>}</Button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-6 py-4"><p className="text-xs font-semibold text-slate-400">Showing 5 of 38 students flagged by model</p><button className="text-xs font-bold text-[#16847e] hover:underline">View full risk report</button></div></section>

        <footer className="mt-6 flex items-center justify-between text-xs text-slate-400"><p className="flex items-center gap-2"><ClipboardList aria-hidden="true" />Model snapshot generated today at 06:00 AM</p><p>CampusStay Admin · v2.4.1</p></footer>
      </div>
    </main>
  )
}

import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileWarning,
  LayoutDashboard,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

const riskRows = [
  { name: 'Maya Patel', id: 'STU-2841', block: 'Block A', count: 3, unpaid: '$180', risk: 'High' },
  { name: 'Ethan Williams', id: 'STU-1982', block: 'Block B', count: 2, unpaid: '$100', risk: 'Medium' },
  { name: 'Sofia Garcia', id: 'STU-3417', block: 'Block C', count: 1, unpaid: '$50', risk: 'Low' },
  { name: 'Noah Johnson', id: 'STU-2276', block: 'Block B', count: 4, unpaid: '$240', risk: 'High' },
  { name: 'Liam Chen', id: 'STU-3104', block: 'Block A', count: 1, unpaid: '$25', risk: 'Low' },
]

const riskStyles = {
  High: 'bg-rose-50 text-rose-700 ring-rose-100',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-100',
  Low: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
}

const summaryStats = [
  { label: 'Total occupancy', value: '92%', detail: '1,104 of 1,200 beds', icon: Users, tone: 'blue' },
  { label: 'Fine revenue', value: '$18,420', detail: 'This academic year', icon: CircleDollarSign, tone: 'teal' },
  { label: 'Pending complaints', value: '24', detail: '7 need attention today', icon: FileWarning, tone: 'amber' },
]

const iconTones = {
  blue: 'bg-blue-50 text-blue-700',
  teal: 'bg-teal-50 text-teal-700',
  amber: 'bg-amber-50 text-amber-700',
}

export default function Page() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-10">
            <a href="#top" className="flex items-center gap-2.5" aria-label="CampusStay command center">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#173b62] text-white shadow-sm"><Building2 aria-hidden="true" /></span>
              <span className="text-[17px] font-bold tracking-[-0.03em] text-[#173b62]">CampusStay</span>
            </a>
            <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-500 md:flex" aria-label="Main navigation">
              <a href="#overview" className="text-[#173b62]">Overview</a>
              <a href="#residents" className="transition-colors hover:text-[#173b62]">Residents</a>
              <a href="#complaints" className="transition-colors hover:text-[#173b62]">Complaints</a>
              <a href="#reports" className="transition-colors hover:text-[#173b62]">Reports</a>
            </nav>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <button className="hidden size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 sm:flex" aria-label="Search"><Search aria-hidden="true" /></button>
            <button className="relative flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700" aria-label="Notifications, 3 unread"><Bell aria-hidden="true" /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" /></button>
            <span className="hidden h-7 w-px bg-slate-200 sm:block" />
            <button className="flex items-center gap-2.5 rounded-lg py-1 text-left" aria-label="Open profile menu">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#dce9f5] text-xs font-bold text-[#173b62]">AM</span>
              <span className="hidden leading-tight sm:block"><span className="block text-[13px] font-semibold text-slate-800">Alex Morgan</span><span className="block text-[11px] text-slate-400">Chief Warden</span></span>
              <ChevronDown className="hidden text-slate-400 sm:block" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div id="overview" className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12 lg:py-11">
        <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#16847e]">Tuesday, October 20, 2026</p>
            <h1 className="text-3xl font-bold tracking-[-0.04em] text-[#173b62] sm:text-[38px]">Good morning, Alex</h1>
            <p className="mt-2 text-[15px] text-slate-500">Here&apos;s your hostel operations overview for today.</p>
          </div>
          <Button variant="outline" className="w-fit border-slate-200 bg-white px-4 text-slate-600 shadow-sm"><Settings2 data-icon="inline-start" aria-hidden="true" />Dashboard settings</Button>
        </section>

        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-[#fffaf0] p-5 shadow-[0_4px_18px_rgba(156,109,33,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-label="Operational alert">
          <div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><AlertTriangle aria-hidden="true" /></span><div><div className="mb-1 flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">Needs attention</p><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">SQL view · live</span></div><h2 className="text-base font-bold tracking-[-0.02em] text-slate-800 sm:text-lg">Spike in Electrical complaints in Block B</h2><p className="mt-1 text-sm text-slate-500">12 complaints recorded in the last 7 days, 4 more than the previous week.</p></div></div>
          <Button className="w-full shrink-0 bg-[#173b62] text-white hover:bg-[#234b76] sm:w-fit">Review complaints<ChevronRight data-icon="inline-end" aria-hidden="true" /></Button>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3" aria-label="Summary statistics">
          {summaryStats.map((stat) => { const Icon = stat.icon; return <article key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(31,55,80,0.03)]"><div className="flex items-start justify-between"><span className={`flex size-10 items-center justify-center rounded-xl ${iconTones[stat.tone as keyof typeof iconTones]}`}><Icon aria-hidden="true" /></span><span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><span className="size-1.5 rounded-full bg-emerald-500" />Live</span></div><p className="mt-5 text-[13px] font-medium text-slate-500">{stat.label}</p><p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#173b62]">{stat.value}</p><p className="mt-1 text-xs text-slate-400">{stat.detail}</p></article> })}
        </section>

        <section id="residents" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(31,55,80,0.03)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7"><div><div className="mb-1 flex items-center gap-2"><LayoutDashboard className="text-[#16847e]" aria-hidden="true" /><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#16847e]">Predictive insights</p></div><h2 className="text-xl font-bold tracking-[-0.03em] text-[#173b62]">Fine-Risk Prediction (Next Month)</h2><p className="mt-1 text-sm text-slate-500">Prioritize outreach using fine history and outstanding balances.</p></div><Button variant="outline" className="w-fit border-slate-200 text-slate-600"><span className="hidden sm:inline">Last refreshed 8:45 AM</span><span className="sm:hidden">Refresh data</span></Button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#f8fafc]"><tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-4 sm:px-7">Student name</th><th className="px-4 py-4">Block</th><th className="px-4 py-4">3M fines count</th><th className="px-4 py-4">Unpaid amount</th><th className="px-4 py-4">Risk score</th><th className="px-6 py-4 text-right sm:px-7">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{riskRows.map((row) => <tr key={row.id} className="transition-colors hover:bg-slate-50/70"><td className="px-6 py-4 sm:px-7"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-[#e7eff7] text-xs font-bold text-[#173b62]">{row.name.split(' ').map((part) => part[0]).join('')}</span><div><p className="text-sm font-semibold text-slate-800">{row.name}</p><p className="mt-0.5 text-[11px] text-slate-400">{row.id}</p></div></div></td><td className="px-4 py-4 text-sm text-slate-600">{row.block}</td><td className="px-4 py-4 text-sm font-semibold text-slate-700">{row.count}</td><td className="px-4 py-4 text-sm font-semibold text-slate-700">{row.unpaid}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${riskStyles[row.risk as keyof typeof riskStyles]}`}><span className="size-1.5 rounded-full bg-current" />{row.risk}</span></td><td className="px-6 py-4 text-right sm:px-7"><Button variant="ghost" size="sm" className="text-[#2c6597] hover:bg-blue-50 hover:text-[#173b62]"><Send data-icon="inline-start" aria-hidden="true" />Send reminder</Button></td></tr>)}</tbody></table></div>
          <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:px-7"><span>Showing 5 of 48 students flagged by the risk model</span><a href="#all-students" className="font-semibold text-[#2c6597] hover:underline">View all predictions <ChevronRight className="inline size-3" aria-hidden="true" /></a></div>
        </section>

        <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-slate-200/80 pt-5 text-xs text-slate-400 sm:flex-row"><span>CampusStay Warden Command Center · Academic year 2026–27</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-emerald-600" aria-hidden="true" />Data synced from hostel operations</span></footer>
      </div>
    </main>
  )
}

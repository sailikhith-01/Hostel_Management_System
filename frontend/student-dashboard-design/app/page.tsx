'use client'

import { useState } from 'react'
import {
  Bell,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  FileWarning,
  LayoutDashboard,
  MessageSquarePlus,
  Receipt,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

const activities = [
  { icon: DoorOpen, title: 'Gate entry logged', detail: 'Main Gate · Today at 8:42 AM', tone: 'blue' },
  { icon: Receipt, title: 'Fine payment received', detail: 'Late entry fine · Yesterday at 4:18 PM', tone: 'teal' },
  { icon: DoorOpen, title: 'Gate exit logged', detail: 'Main Gate · Yesterday at 7:05 AM', tone: 'slate' },
]

export default function Page() {
  const [notice, setNotice] = useState('')

  function handleAction(label: string) {
    setNotice(`${label} opened`)
    window.setTimeout(() => setNotice(''), 2400)
  }

  return (
    <main className="min-h-screen bg-[#f6f9fc] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-10">
            <a href="#top" className="flex items-center gap-2.5" aria-label="CampusStay dashboard">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#173b62] text-white"><LayoutDashboard aria-hidden="true" /></span>
              <span className="text-[17px] font-bold tracking-[-0.03em] text-[#173b62]">CampusStay</span>
            </a>
            <nav className="hidden items-center gap-7 text-[13px] font-semibold text-slate-500 md:flex" aria-label="Main navigation">
              <a href="#dashboard" className="text-[#173b62]">Dashboard</a>
              <a href="#room" className="hover:text-[#173b62]">My room</a>
              <a href="#activity" className="hover:text-[#173b62]">Activity</a>
            </nav>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-50" aria-label="View notifications"><Bell aria-hidden="true" /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#16847e] ring-2 ring-white" /></button>
            <span className="h-7 w-px bg-slate-200" />
            <button className="flex items-center gap-2.5 rounded-lg py-1 text-left" aria-label="Open profile menu"><span className="flex size-9 items-center justify-center rounded-full bg-[#dce9f5] text-xs font-bold text-[#173b62]">JS</span><span className="hidden leading-tight sm:block"><span className="block text-[13px] font-semibold text-slate-800">Jordan Smith</span><span className="block text-[11px] text-slate-400">Student · CS24A102</span></span><ChevronDown className="hidden text-slate-400 sm:block" aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <div id="dashboard" className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-11">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#16847e]">Student portal</p><h1 className="text-3xl font-bold tracking-[-0.04em] text-[#173b62] sm:text-[38px]">Good morning, Jordan</h1><p className="mt-2 text-[15px] text-slate-500">Here&apos;s what&apos;s happening with your hostel stay.</p></div>
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-400"><span className="size-2 rounded-full bg-emerald-500" />Last synced just now</span>
        </div>

        <section id="room" className="mb-6 overflow-hidden rounded-2xl bg-[#173b62] text-white shadow-[0_10px_28px_rgba(23,59,98,0.14)]">
          <div className="flex flex-col justify-between gap-8 p-6 sm:p-8 lg:flex-row lg:items-center"><div><div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8fd9d0]"><Building2 aria-hidden="true" />Current allocation</div><h2 className="text-2xl font-bold tracking-[-0.035em] sm:text-[28px]">My Room &amp; Bed</h2><p className="mt-2 text-sm text-blue-100/70">Your current hostel accommodation details</p></div><div className="grid grid-cols-3 gap-6 sm:gap-12"><div><p className="text-xs font-medium text-blue-100/60">Block</p><p className="mt-2 text-xl font-bold">A</p></div><div><p className="text-xs font-medium text-blue-100/60">Room</p><p className="mt-2 text-xl font-bold">102</p></div><div><p className="text-xs font-medium text-blue-100/60">Sharing</p><p className="mt-2 text-xl font-bold">3 sharing</p></div></div><div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3"><span className="flex size-9 items-center justify-center rounded-lg bg-[#8fd9d0]/15 text-[#a9eee5]"><BedDouble aria-hidden="true" /></span><div><p className="text-[11px] text-blue-100/60">Bed assignment</p><p className="text-sm font-bold">Bed 1 · Occupied</p></div><CheckCircle2 className="ml-2 text-[#8fd9d0]" aria-hidden="true" /></div></div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2" aria-label="Quick stats">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_18px_rgba(31,55,80,0.03)]"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">Outstanding fines</p><p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#173b62]">$100.00</p><p className="mt-2 text-xs font-medium text-amber-600">1 payment due</p></div><span className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FileWarning aria-hidden="true" /></span></div></div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_18px_rgba(31,55,80,0.03)]"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">Active complaints</p><p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#173b62]">01</p><p className="mt-2 text-xs font-medium text-[#16847e]">In progress · AC-1042</p></div><span className="flex size-11 items-center justify-center rounded-xl bg-[#e8f7f5] text-[#16847e]"><MessageSquarePlus aria-hidden="true" /></span></div></div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_18px_rgba(31,55,80,0.03)]"><div className="mb-5 flex items-center gap-2"><ClipboardList className="text-[#16847e]" aria-hidden="true" /><h2 className="text-lg font-bold tracking-[-0.03em] text-[#173b62]">Quick actions</h2></div><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><Button onClick={() => handleAction('Roommate survey')} className="h-auto justify-start gap-3 bg-[#eef7ff] px-4 py-4 text-left text-[#173b62] shadow-none hover:bg-[#e2f1fc]"><Users data-icon="inline-start" /> <span><span className="block text-sm font-bold">Fill Roommate Survey</span><span className="mt-1 block text-xs font-normal text-slate-500">Help us find your best match</span></span></Button><Button onClick={() => handleAction('Complaint form')} variant="outline" className="h-auto justify-start gap-3 border-slate-200 px-4 py-4 text-left text-slate-700"><MessageSquarePlus data-icon="inline-start" /> <span><span className="block text-sm font-bold">Raise Complaint</span><span className="mt-1 block text-xs font-normal text-slate-400">Report a hostel issue</span></span></Button><Button onClick={() => handleAction('Fines')} variant="outline" className="h-auto justify-start gap-3 border-slate-200 px-4 py-4 text-left text-slate-700"><Receipt data-icon="inline-start" /> <span><span className="block text-sm font-bold">View Fines</span><span className="mt-1 block text-xs font-normal text-slate-400">Review payment history</span></span></Button></div>{notice && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700" role="status">{notice}</p>}</section>
          <section id="activity" className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_18px_rgba(31,55,80,0.03)]"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold tracking-[-0.03em] text-[#173b62]">Recent activity</h2><a href="#activity" className="text-xs font-bold text-[#16847e] hover:underline">View all</a></div><div className="flex flex-col gap-1">{activities.map((item) => { const Icon = item.icon; return <div key={item.title + item.detail} className="flex items-center gap-4 rounded-xl px-2 py-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.tone === 'teal' ? 'bg-[#e8f7f5] text-[#16847e]' : item.tone === 'blue' ? 'bg-[#eef7ff] text-[#2c6597]' : 'bg-slate-100 text-slate-500'}`}><Icon aria-hidden="true" /></span><div><p className="text-sm font-semibold text-slate-700">{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.detail}</p></div></div> })}</div></section>
        </div>
      </div>
    </main>
  )
}

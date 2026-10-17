import {
  ArrowUpRight,
  BedDouble,
  Bell,
  Building2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  DoorOpen,
  FileWarning,
  Home,
  LogIn,
  LogOut,
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

const stats = [
  {
    label: 'Outstanding fines',
    value: '$100',
    detail: 'Due by Oct 30, 2026',
    icon: CircleDollarSign,
    tone: 'amber',
  },
  {
    label: 'Active complaints',
    value: '01',
    detail: '1 in progress',
    icon: FileWarning,
    tone: 'rose',
  },
  {
    label: 'Roommate match',
    value: 'Confirmed',
    detail: 'Matched on Sep 14, 2026',
    icon: Users,
    tone: 'teal',
  },
]

const activities = [
  { icon: LogIn, title: 'Checked in at North Gate', detail: 'Today, 8:42 AM', tone: 'teal' },
  { icon: CircleDollarSign, title: 'Fine payment reminder', detail: 'Yesterday, 3:20 PM', tone: 'amber' },
  { icon: LogOut, title: 'Checked out at North Gate', detail: 'Oct 14, 10:16 PM', tone: 'slate' },
  { icon: MessageSquarePlus, title: 'Complaint #1048 updated', detail: 'Oct 13, 11:05 AM', tone: 'violet' },
]

const toneStyles = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  teal: 'bg-teal-50 text-teal-700 ring-teal-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
}

export default function Page() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-10">
            <a href="#top" className="flex items-center gap-2.5" aria-label="CampusStay home">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#173b62] text-white shadow-sm">
                <Building2 aria-hidden="true" />
              </span>
              <span className="text-[17px] font-bold tracking-[-0.03em] text-[#173b62]">CampusStay</span>
            </a>
            <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-500 md:flex" aria-label="Main navigation">
              <a href="#dashboard" className="text-[#173b62]">Dashboard</a>
              <a href="#room" className="transition-colors hover:text-[#173b62]">My room</a>
              <a href="#activity" className="transition-colors hover:text-[#173b62]">Activity</a>
              <a href="#support" className="transition-colors hover:text-[#173b62]">Support</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="hidden size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 sm:flex" aria-label="Search">
              <Search aria-hidden="true" />
            </button>
            <button className="relative flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700" aria-label="Notifications, 2 unread">
              <Bell aria-hidden="true" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>
            <span className="hidden h-7 w-px bg-slate-200 sm:block" />
            <button className="flex items-center gap-2.5 rounded-lg py-1 text-left" aria-label="Open profile menu">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#dce9f5] text-xs font-bold text-[#173b62]">JD</span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[13px] font-semibold text-slate-800">Jordan Davis</span>
                <span className="block text-[11px] text-slate-400">Student ID · STU-2841</span>
              </span>
              <ChevronRight className="hidden rotate-90 text-slate-400 sm:block" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div id="dashboard" className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
        <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#16847e]">Tuesday, October 20, 2026</p>
            <h1 className="text-3xl font-bold tracking-[-0.04em] text-[#173b62] sm:text-[38px]">Good morning, Jordan</h1>
            <p className="mt-2 text-[15px] text-slate-500">Here&apos;s what&apos;s happening with your hostel stay.</p>
          </div>
          <Button variant="outline" className="w-fit border-slate-200 bg-white px-4 text-slate-600 shadow-sm">
            <MoreHorizontal data-icon="inline-start" aria-hidden="true" />
            More options
          </Button>
        </section>

        <section id="room" className="mb-6 overflow-hidden rounded-2xl bg-[#173b62] shadow-[0_14px_35px_rgba(23,59,98,0.15)]">
          <div className="flex flex-col justify-between gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:px-10 lg:py-9">
            <div className="flex items-center gap-5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#a9e6df] ring-1 ring-white/10">
                <BedDouble aria-hidden="true" />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8bcfc8]">My room &amp; bed</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b8f0e8]/15 px-2.5 py-1 text-[11px] font-semibold text-[#b8f0e8]"><span className="size-1.5 rounded-full bg-[#6ee7d6]" />Occupied</span>
                </div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">Block A <span className="font-normal text-white/40">/</span> Room 102 <span className="font-normal text-white/40">/</span> Bed 1</h2>
                <p className="mt-2 text-sm text-white/60">North Campus Residence · 2026–27 academic year</p>
              </div>
            </div>
            <Button className="w-full bg-white text-[#173b62] hover:bg-[#eaf4f7] sm:w-fit">
              View room details
              <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
          <div className="grid border-t border-white/10 bg-black/10 sm:grid-cols-3">
            <div className="flex items-center gap-3 px-6 py-4 lg:px-10"><Home className="text-[#8bcfc8]" aria-hidden="true" /><span className="text-xs text-white/55">Residence</span><strong className="ml-auto text-sm text-white">North Campus</strong></div>
            <div className="flex items-center gap-3 border-white/10 px-6 py-4 sm:border-x lg:px-10"><DoorOpen className="text-[#8bcfc8]" aria-hidden="true" /><span className="text-xs text-white/55">Floor</span><strong className="ml-auto text-sm text-white">1st floor</strong></div>
            <div className="flex items-center gap-3 px-6 py-4 lg:px-10"><ShieldCheck className="text-[#8bcfc8]" aria-hidden="true" /><span className="text-xs text-white/55">Room status</span><strong className="ml-auto text-sm text-white">Good standing</strong></div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return <article key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(31,55,80,0.03)]">
              <div className="flex items-start justify-between"><span className={`flex size-10 items-center justify-center rounded-xl ring-1 ${toneStyles[stat.tone as keyof typeof toneStyles]}`}><Icon aria-hidden="true" /></span><button aria-label={`View ${stat.label}`} className="text-slate-300 hover:text-slate-600"><ArrowUpRight aria-hidden="true" /></button></div>
              <p className="mt-5 text-[13px] font-medium text-slate-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#173b62]">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-400">{stat.detail}</p>
            </article>
          })}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section id="support" className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_18px_rgba(31,55,80,0.03)] sm:p-7">
            <div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#16847e]">Get things done</p><h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#173b62]">Quick actions</h2></div><Sparkles className="text-[#a9dcd7]" aria-hidden="true" /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <a href="#survey" className="group rounded-xl border border-slate-200 p-4 transition-all hover:-translate-y-0.5 hover:border-[#8bcfc8] hover:shadow-md"><span className="mb-8 flex size-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Users aria-hidden="true" /></span><span className="block text-sm font-semibold leading-snug text-slate-800">Fill roommate survey</span><span className="mt-2 flex items-center gap-1 text-xs font-medium text-teal-700">Start now <ChevronRight aria-hidden="true" /></span></a>
              <a href="#complaint" className="group rounded-xl border border-slate-200 p-4 transition-all hover:-translate-y-0.5 hover:border-[#b5c9de] hover:shadow-md"><span className="mb-8 flex size-10 items-center justify-center rounded-lg bg-blue-50 text-[#2c6597]"><MessageSquarePlus aria-hidden="true" /></span><span className="block text-sm font-semibold leading-snug text-slate-800">Raise a complaint</span><span className="mt-2 flex items-center gap-1 text-xs font-medium text-[#2c6597]">Get help <ChevronRight aria-hidden="true" /></span></a>
              <a href="#fines" className="group rounded-xl border border-slate-200 p-4 transition-all hover:-translate-y-0.5 hover:border-[#f5d29a] hover:shadow-md"><span className="mb-8 flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><ClipboardList aria-hidden="true" /></span><span className="block text-sm font-semibold leading-snug text-slate-800">View fines</span><span className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">Review balance <ChevronRight aria-hidden="true" /></span></a>
            </div>
          </section>

          <section id="activity" className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_4px_18px_rgba(31,55,80,0.03)] sm:p-7">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#16847e]">Your timeline</p><h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#173b62]">Recent activity</h2></div><a href="#all-activity" className="text-xs font-semibold text-[#2c6597] hover:underline">View all</a></div>
            <div className="flex flex-col">
              {activities.map((activity) => { const Icon = activity.icon; return <div key={activity.title} className="flex gap-3 border-b border-slate-100 py-3.5 last:border-0"><span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ${toneStyles[activity.tone as keyof typeof toneStyles]}`}><Icon aria-hidden="true" /></span><div className="min-w-0"><p className="text-[13px] font-semibold text-slate-700">{activity.title}</p><p className="mt-0.5 text-xs text-slate-400">{activity.detail}</p></div><ChevronRight className="ml-auto mt-1 shrink-0 text-slate-300" aria-hidden="true" /></div> })}
            </div>
          </section>
        </div>

        <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-slate-200/80 pt-5 text-xs text-slate-400 sm:flex-row"><span>CampusStay Student Portal · Academic year 2026–27</span><span>Need help? <a href="#support" className="font-medium text-[#2c6597] hover:underline">Contact hostel support</a></span></footer>
      </div>
    </main>
  )
}

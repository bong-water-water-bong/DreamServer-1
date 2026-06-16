import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const STATUS_LABELS = {
  ready_for_review: 'Ready for review',
  missing_info: 'Missing info',
  drafting: 'Drafting',
  blocked: 'Blocked',
}

const STATUS_TONES = {
  ready_for_review: 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200',
  missing_info: 'border-amber-400/35 bg-amber-400/[0.08] text-amber-200',
  drafting: 'border-sky-400/30 bg-sky-400/[0.08] text-sky-200',
  blocked: 'border-red-400/30 bg-red-400/[0.08] text-red-200',
}

const PRIORITY_TONES = {
  urgent: 'text-red-300',
  high: 'text-amber-200',
  medium: 'text-sky-200',
}

const CONTROL_TONES = {
  ready: { label: 'Ready', className: 'text-emerald-200', icon: CheckCircle2 },
  degraded: { label: 'Degraded', className: 'text-amber-200', icon: AlertTriangle },
  planned: { label: 'Planned', className: 'text-sky-200', icon: Clock3 },
  prototype: { label: 'Prototype', className: 'text-violet-200', icon: ShieldCheck },
  blocked: { label: 'Blocked', className: 'text-red-200', icon: AlertTriangle },
}

function formatStatus(value) {
  return STATUS_LABELS[value] || String(value || 'Unknown').replace(/_/g, ' ')
}

function formatDue(hours) {
  if (hours <= 1) return '<1h'
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export default function CareOps() {
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')
  const [activeModule, setActiveModule] = useState('all')

  useEffect(() => {
    let cancelled = false
    fetch('/api/careops')
      .then(response => {
        if (!response.ok) throw new Error('CareOps payload unavailable')
        return response.json()
      })
      .then(data => {
        if (!cancelled) setPayload(data)
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'CareOps payload unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const queueItems = useMemo(() => {
    const items = payload?.queueItems || []
    if (activeModule === 'all') return items
    return items.filter(item => item.moduleId === activeModule)
  }, [payload, activeModule])

  if (error) {
    return (
      <main className="min-h-screen px-5 py-6 text-theme-text md:px-8">
        <div className="rounded-lg border border-red-400/25 bg-red-400/[0.08] p-4 text-sm text-red-100">
          {error}
        </div>
      </main>
    )
  }

  if (!payload) {
    return (
      <main className="min-h-screen px-5 py-6 text-theme-text md:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(index => (
            <div key={index} className="h-28 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.035]" />
          ))}
        </div>
      </main>
    )
  }

  const summary = payload.summary || {}
  const modules = payload.modules || []
  const controls = payload.controls || []
  const auditEvents = payload.auditEvents || []

  return (
    <main className="min-h-screen px-5 py-6 text-theme-text md:px-8">
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
            <Lock size={13} />
            Local PHI workflow surface
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-theme-text md:text-3xl">
            CareOps
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <SummaryTile label="Open" value={summary.totalOpen} tone="text-theme-text" />
          <SummaryTile label="Due today" value={summary.dueToday} tone="text-amber-200" />
          <SummaryTile label="Ready" value={summary.readyForReview} tone="text-emerald-200" />
          <SummaryTile label="Blocked" value={summary.blocked} tone="text-red-200" />
        </div>
      </header>

      <section className="mb-5 grid gap-3 lg:grid-cols-5">
        {controls.map(control => (
          <ControlTile key={control.id} control={control} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-emerald-200" />
              <h2 className="text-base font-semibold">Work Queue</h2>
            </div>
            <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-white/[0.08] bg-black/20 p-1">
              <ModuleFilter
                active={activeModule === 'all'}
                label="All"
                onClick={() => setActiveModule('all')}
              />
              {modules.filter(module => module.enabled).map(module => (
                <ModuleFilter
                  key={module.id}
                  active={activeModule === module.id}
                  label={module.queue}
                  onClick={() => setActiveModule(module.id)}
                />
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/20">
            <div className="hidden grid-cols-[96px_minmax(180px,1fr)_112px_104px_120px_150px] gap-4 border-b border-white/[0.06] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-muted md:grid">
              <span>ID</span>
              <span>Request</span>
              <span>Status</span>
              <span>Due</span>
              <span>Evidence</span>
              <span>Next action</span>
            </div>
            <div className="divide-y divide-white/[0.055]">
              {queueItems.map(item => (
                <QueueRow key={item.id} item={item} modules={modules} />
              ))}
            </div>
          </div>
        </div>

        <aside className="grid gap-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-sky-200" />
              <h2 className="text-base font-semibold">Modules</h2>
            </div>
            <div className="grid gap-2">
              {modules.map(module => (
                <ModuleTile key={module.id} module={module} />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <FileText size={18} className="text-amber-200" />
              <h2 className="text-base font-semibold">Audit Tail</h2>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-black/20">
              {auditEvents.map(event => (
                <div key={event.id} className="border-b border-white/[0.055] px-4 py-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-theme-text-secondary">{event.workItemId}</span>
                    <span className="rounded border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                      {event.result}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-theme-text">{event.action.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-[11px] text-theme-text-muted">{event.policy}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}

function SummaryTile({ label, value, tone }) {
  return (
    <div className="min-w-24 rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-theme-text-muted">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${tone}`}>{value ?? 0}</p>
    </div>
  )
}

function ControlTile({ control }) {
  const tone = CONTROL_TONES[control.state] || CONTROL_TONES.blocked
  const Icon = tone.icon
  return (
    <div className="min-h-28 rounded-lg border border-white/[0.08] bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Icon size={16} className={tone.className} />
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${tone.className}`}>
          {tone.label}
        </span>
      </div>
      <p className="text-sm font-semibold text-theme-text">{control.name}</p>
      <p className="mt-1 text-xs text-theme-text-muted">{control.mode}</p>
    </div>
  )
}

function ModuleFilter({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 rounded-md px-3 text-xs font-semibold transition-colors ${
        active
          ? 'bg-emerald-400/15 text-emerald-100'
          : 'text-theme-text-muted hover:bg-white/[0.045] hover:text-theme-text'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

function QueueRow({ item, modules }) {
  const module = modules.find(candidate => candidate.id === item.moduleId)
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[96px_minmax(180px,1fr)_112px_104px_120px_150px] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="font-mono text-xs font-semibold text-theme-text">{item.id}</p>
        <p className="mt-1 text-[11px] text-theme-text-muted">{item.patientRef}</p>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.priority === 'urgent' ? 'bg-red-300' : item.priority === 'high' ? 'bg-amber-300' : 'bg-sky-300'}`} />
          <p className="truncate text-sm font-semibold text-theme-text">{item.requestType}</p>
        </div>
        <p className="mt-1 truncate text-xs text-theme-text-muted">
          {module?.queue || item.moduleId} / {item.serviceLine}
        </p>
      </div>
      <div>
        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${STATUS_TONES[item.status] || STATUS_TONES.blocked}`}>
          {formatStatus(item.status)}
        </span>
      </div>
      <div className={`font-mono text-sm font-semibold ${PRIORITY_TONES[item.priority] || 'text-theme-text-secondary'}`}>
        {formatDue(item.dueInHours)}
      </div>
      <div className="flex items-center gap-2 text-xs text-theme-text-secondary">
        <FileText size={14} className="text-theme-text-muted" />
        {item.evidenceCount}
        {item.missingInfo.length > 0 && (
          <AlertTriangle size={14} className="text-amber-200" aria-label="Missing information" />
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-theme-text-secondary">
        <UserCheck size={14} className="text-emerald-200" />
        <span className="truncate">{item.nextAction}</span>
      </div>
    </div>
  )
}

function ModuleTile({ module }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-theme-text">{module.name}</p>
          <p className="mt-1 text-xs text-theme-text-muted">{module.ownerRole}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold uppercase ${
          module.enabled
            ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200'
            : 'border-white/[0.08] bg-white/[0.035] text-theme-text-muted'
        }`}>
          {module.enabled ? module.stage : 'off'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Open" value={module.metrics.open} />
        <Metric label="Today" value={module.metrics.dueToday} />
        <Metric label="Ready" value={module.metrics.readyForReview} />
      </div>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-1.5">
      <p className="font-mono text-sm font-semibold text-theme-text">{value}</p>
      <p className="text-[10px] text-theme-text-muted">{label}</p>
    </div>
  )
}

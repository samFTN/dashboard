'use client'

import { useState } from 'react'
import { LeadRow } from './LeadsClient'

type Action = {
  id: string
  type: string
  date: string
  note: string | null
  prochaine_action_type?: string
  prochaine_action_date?: string
  prochaine_action_note?: string | null
}

const STATUT_LABELS: Record<string, string> = {
  non_qualifie: 'Non qualifié',
  qualifie: '1. Qualifié',
  reserve: '2. Réservé',
  present: '3. Présent',
  eleve: '4. Élève',
  ancien_eleve: 'Ancien élève',
}

const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  non_qualifie: { bg: '#fef2f2', color: '#dc2626' },
  qualifie: { bg: '#eff6ff', color: '#1d4ed8' },
  reserve: { bg: '#fef9e3', color: '#a16207' },
  present: { bg: '#f0fdf4', color: '#15803d' },
  eleve: { bg: '#fef9e3', color: '#d4a017' },
  ancien_eleve: { bg: '#faf5ff', color: '#7c3aed' },
}

const ARCHIVE_REASONS = [
  { value: 'non_qualifie', label: 'Non qualifié' },
  { value: 'sans_reponse', label: 'Sans réponse' },
  { value: 'abandon', label: 'Abandon' },
  { value: 'budget', label: 'Budget' },
]

const NEXT_STATUT: Record<string, string | null> = {
  nouveau: 'qualifie',
  qualifie: 'reserve',
  reserve: 'present',
  present: null,
  eleve: null,
  ancien_eleve: null,
}

function StatusBadge({ statut }: { statut: string }) {
  const c = STATUT_COLORS[statut] ?? { bg: '#f3f4f6', color: '#4b5563' }
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {STATUT_LABELS[statut] ?? statut}
    </span>
  )
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export default function SwipeableLeadCard({
  lead,
  onOpen,
  onQuickAction,
  onQuickStatut,
  onQuickArchive,
}: {
  lead: LeadRow
  onOpen: () => void
  onQuickAction: (leadId: string, action: Action) => void
  onQuickStatut: (leadId: string, statut: string) => void
  onQuickArchive: (leadId: string) => void
  isOpen: boolean
  onSwipeOpen: (leadId: string | null) => void
}) {
  const [loading, setLoading] = useState(false)
  const [showArchiveMenu, setShowArchiveMenu] = useState(false)

  async function handleQuickCall() {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch(`/api/leads/${lead.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'appel', date: today, note: null }),
      })
      if (!res.ok) throw new Error()
      const action: Action = await res.json()
      onQuickAction(lead.id, action)
    } catch {
      alert('Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function handleNextStatut() {
    const next = NEXT_STATUT[lead.statut]
    if (!next) {
      onOpen()
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: next }),
      })
      if (!res.ok) throw new Error()
      onQuickStatut(lead.id, next)
    } catch {
      alert('Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function handleArchive(reason: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}/archiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raison: reason }),
      })
      if (!res.ok) throw new Error()
      onQuickArchive(lead.id)
      setShowArchiveMenu(false)
    } catch {
      alert('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-lg border p-3 cursor-pointer transition-all"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
      onClick={() => onOpen()}
    >
      {/* Infos principales */}
      <p style={{ color: 'var(--dark)', fontWeight: '600', fontSize: '14px', margin: '0 0 4px 0' }}>
        {lead.nom}
      </p>
      <p style={{ color: 'var(--muted2)', fontSize: '12px', margin: '0 0 8px 0' }}>
        {lead.email}
      </p>

      {/* Statut */}
      <div className="flex items-center gap-2 mb-3">
        <StatusBadge statut={lead.statut} />
      </div>

      {/* Prochaine action - affichée en évidence */}
      {(() => {
        const actionType = lead.prochaine_action_type
          ?? (lead.statut === 'reserve' && lead.cours_essai_date ? 'cours_essai' : null)
        const actionDate = lead.prochaine_action_date
          ?? (lead.statut === 'reserve' ? lead.cours_essai_date : null)
        if (!actionType) return null
        const typeLabel = {
          'appel': 'Appel',
          'sms': 'SMS',
          'whatsapp': 'WhatsApp',
          'mail': 'Mail',
          'cours_essai': "Cours d'essai",
          'cours_offert': 'Cours offert',
          'temoignage': 'Témoignage'
        }[actionType] ?? actionType
        return (
          <div className="mb-3 p-2 rounded-lg" style={{ background: 'var(--accent-soft)', border: '1px solid #fde68a' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)', marginBottom: 3 }}>Prochaine action</p>
            <p className="text-xs font-semibold" style={{ color: 'var(--accent)', marginBottom: 1 }}>
              {typeLabel}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>
              {fmt(actionDate)}
            </p>
          </div>
        )
      })()}

      {/* Actions - 3 boutons simples et cliquables */}
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        {/* Appel */}
        <button
          onClick={handleQuickCall}
          disabled={loading}
          className="flex-1 py-1.5 px-2 rounded text-white text-[11px] font-semibold transition-opacity"
          style={{
            background: '#3b82f6',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          📞 Appel
        </button>

        {/* Étape suivante */}
        <button
          onClick={handleNextStatut}
          disabled={loading}
          className="flex-1 py-1.5 px-2 rounded text-white text-[11px] font-semibold transition-opacity"
          style={{
            background: '#10b981',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          → Suivant
        </button>

        {/* Archiver */}
        {!showArchiveMenu ? (
          <button
            onClick={() => setShowArchiveMenu(true)}
            disabled={loading}
            className="flex-1 py-1.5 px-2 rounded text-white text-[11px] font-semibold transition-opacity"
            style={{
              background: '#ef4444',
              border: 'none',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            🗄️ Archive
          </button>
        ) : (
          <select
            onChange={e => {
              if (e.target.value) {
                handleArchive(e.target.value)
              }
            }}
            disabled={loading}
            className="flex-1 py-1.5 px-2 rounded text-[11px] font-semibold"
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
            autoFocus
          >
            <option value="">Raison...</option>
            {ARCHIVE_REASONS.map(r => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

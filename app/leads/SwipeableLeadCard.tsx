'use client'

import { useState, useRef } from 'react'
import { LeadRow } from './LeadsClient'

type Action = {
  id: string
  type: string
  date: string
  note: string | null
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
      className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {STATUT_LABELS[statut] ?? statut}
    </span>
  )
}

export default function SwipeableLeadCard({
  lead,
  onOpen,
  onQuickAction,
  onQuickStatut,
  onQuickArchive,
  isOpen,
  onSwipeOpen,
}: {
  lead: LeadRow
  onOpen: () => void
  onQuickAction: (leadId: string, action: Action) => void
  onQuickStatut: (leadId: string, statut: string) => void
  onQuickArchive: (leadId: string) => void
  isOpen: boolean
  onSwipeOpen: (leadId: string | null) => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showArchiveReasons, setShowArchiveReasons] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const touchStartX = useRef(0)

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    setError(null)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStartX.current) return
    const delta = e.touches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 5) {
      setIsDragging(true)
      setSwipeX(Math.max(-100, Math.min(100, delta * 0.6)))
    }
  }

  function onTouchEnd() {
    setIsDragging(false)
    if (Math.abs(swipeX) > 50) {
      if (swipeX < 0) {
        setSwipeX(-100)
        onSwipeOpen(lead.id)
      } else {
        setSwipeX(100)
        onSwipeOpen(lead.id)
      }
    } else if (Math.abs(swipeX) < 5) {
      onOpen()
      setSwipeX(0)
      onSwipeOpen(null)
    } else {
      setSwipeX(0)
      onSwipeOpen(null)
    }
    touchStartX.current = 0
  }

  async function handleQuickCall() {
    setLoading(true)
    setError(null)
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
      setSwipeX(0)
      onSwipeOpen(null)
    } catch {
      setError('Erreur')
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
    setError(null)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: next }),
      })
      if (!res.ok) throw new Error()
      onQuickStatut(lead.id, next)
      setSwipeX(0)
      onSwipeOpen(null)
    } catch {
      setError('Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function handleArchiveWithReason(reason: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${lead.id}/archiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raison: reason }),
      })
      if (!res.ok) throw new Error()
      onQuickArchive(lead.id)
      setSwipeX(0)
      onSwipeOpen(null)
      setShowArchiveReasons(false)
    } catch {
      setError('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--border)', height: '100px' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Fond gauche - Archiver */}
      <div className="absolute left-0 top-0 w-24 h-full flex items-center justify-center" style={{ background: '#ef4444' }}>
        <span style={{ color: 'white', fontSize: '20px' }}>🗄️</span>
      </div>

      {/* Fond droite - Appel + Suivant */}
      <div className="absolute right-0 top-0 w-48 h-full flex" style={{ background: 'linear-gradient(to left, #3b82f6 0%, #10b981 100%)' }}>
        <div className="flex-1 flex items-center justify-center" style={{ color: 'white', fontSize: '20px' }}>
          📞
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ color: 'white', fontSize: '20px' }}>
          →
        </div>
      </div>

      {/* Carte principale */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'var(--card)',
          transform: `translateX(${swipeX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
        onClick={() => !isDragging && onOpen()}
      >
        <div>
          <p style={{ color: 'var(--dark)', fontWeight: '600', fontSize: '14px', margin: '0 0 4px 0' }}>
            {lead.nom}
          </p>
          <p style={{ color: 'var(--muted2)', fontSize: '12px', margin: '0' }}>
            {lead.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge statut={lead.statut} />
          <span style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>
            {lead.dernier_contact_date ? '✓ ' + new Date(lead.dernier_contact_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
          </span>
        </div>
      </div>

      {/* Boutons quand swipé à gauche (archiver) */}
      {swipeX < -50 && (
        <div className="absolute left-0 top-0 w-24 h-full flex items-center justify-center z-10">
          {!showArchiveReasons ? (
            <button
              onClick={() => setShowArchiveReasons(true)}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              Archiver
            </button>
          ) : (
            <select
              onChange={e => handleArchiveWithReason(e.target.value)}
              disabled={loading}
              style={{
                background: 'white',
                border: 'none',
                fontSize: '11px',
                padding: '4px',
                width: '90%',
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
      )}

      {/* Boutons quand swipé à droite (appel + suivant) */}
      {swipeX > 50 && (
        <div className="absolute right-0 top-0 h-full flex z-10" style={{ width: '200px' }}>
          <button
            onClick={handleQuickCall}
            disabled={loading}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            Appel
          </button>
          <button
            onClick={handleNextStatut}
            disabled={loading}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            Suivant
          </button>
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'red', fontSize: '10px' }}>
          {error}
        </div>
      )}
    </div>
  )
}

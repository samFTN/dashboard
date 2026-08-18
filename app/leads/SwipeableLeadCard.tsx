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

const NEXT_STATUT: Record<string, string | null> = {
  nouveau: 'qualifie',
  qualifie: 'reserve',
  reserve: 'present',
  present: null,
  eleve: null,
  ancien_eleve: null,
}

const ARCHIVE_REASONS = [
  { value: 'non_qualifie', label: 'Non qualifié' },
  { value: 'sans_reponse', label: 'Sans réponse' },
  { value: 'abandon', label: 'Abandon' },
  { value: 'budget', label: 'Budget' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const contactDay = new Date(iso)
  contactDay.setHours(0, 0, 0, 0)
  const d = Math.round((today.getTime() - contactDay.getTime()) / 86_400_000)
  if (d < 0) return '—'
  if (d === 0) return 'auj.'
  if (d === 1) return '1j'
  if (d < 7) return `${d}j`
  if (d < 30) return `${Math.floor(d / 7)} sem.`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
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
  const cardRef = useRef<HTMLDivElement>(null)

  const actionType = lead.prochaine_action_type ?? (lead.statut === 'reserve' && lead.cours_essai_date ? 'cours_essai' : null)
  const actionDate = lead.prochaine_action_date ?? (lead.statut === 'reserve' ? lead.cours_essai_date : null)

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    setError(null)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchStartX.current) return
    const delta = e.touches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 5) {
      setIsDragging(true)
      setSwipeX(Math.max(-150, Math.min(150, delta * 0.6)))
    }
  }

  function onTouchEnd() {
    setIsDragging(false)
    if (Math.abs(swipeX) > 50) {
      const direction = swipeX > 0 ? 'right' : 'left'
      if (direction === 'right') {
        setSwipeX(120)
        onSwipeOpen(lead.id)
        setShowArchiveReasons(false)
      } else {
        setSwipeX(-120)
        onSwipeOpen(lead.id)
        setShowArchiveReasons(false)
      }
    } else if (Math.abs(swipeX) < 5) {
      onOpen()
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
      setError('Erreur lors de l\'enregistrement')
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
      setError('Erreur lors de la mise à jour')
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
      setError('Erreur lors de l\'archivage')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden rounded-lg cursor-pointer"
      style={{
        background: 'var(--card)',
        height: '120px',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Fond d'actions (droite) - appel + suivant */}
      <div className="absolute inset-y-0 right-0 flex items-stretch" style={{ background: 'linear-gradient(to left, #3b82f6, #10b981)' }}>
        <div className="flex-1 flex items-center justify-center text-white text-xs font-semibold opacity-60" style={{ width: '80px' }}>
          📞
        </div>
        <div className="flex-1 flex items-center justify-center text-white text-xs font-semibold opacity-60" style={{ width: '80px' }}>
          →
        </div>
      </div>

      {/* Fond d'actions (gauche) - archiver */}
      <div className="absolute inset-y-0 left-0 flex items-center justify-center" style={{ width: '80px', background: '#ef4444' }}>
        <span className="text-white text-xs font-semibold opacity-60">🗄️</span>
      </div>

      {/* Contenu principal (carte) */}
      <div
        className="absolute inset-0 p-2.5 rounded-lg"
        style={{
          background: 'var(--card)',
          transform: `translateX(${swipeX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          border: `1px solid var(--border)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Nom + Email */}
          <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--dark)' }}>
            {lead.nom}
          </p>
          <p className="text-[11px] mt-0.5 leading-tight" style={{ color: 'var(--muted2)' }}>
            {lead.email}
          </p>

          {/* Badge statut + source */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <StatusBadge statut={lead.raison_archivage === 'non_qualifie' ? 'non_qualifie' : lead.statut} />
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--muted2)' }}>
              {lead.source === 'pub_meta' ? 'Meta Ads' : 'Org'}
            </span>
          </div>
        </div>

        {/* Prochaine action (compacte) */}
        <div className="text-[10px] leading-tight" style={{ color: 'var(--muted2)' }}>
          {actionType ? (
            <p style={{ color: 'var(--accent)' }}>
              {
                {
                  appel: '📞',
                  sms: '📱',
                  whatsapp: '💬',
                  mail: '📧',
                  cours_essai: '🎸',
                  cours_offert: '🎁',
                  temoignage: '⭐',
                }[actionType] ?? '—'
              }{' '}
              {actionDate && new Date(actionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </p>
          ) : (
            <p>—</p>
          )}
        </div>

        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>

      {/* Overlay clickable pour les actions (uniquement au swipe max) */}
      {swipeX < -100 && (
        <div
          className="absolute left-0 top-0 h-full"
          style={{
            width: '80px',
            zIndex: 30,
            pointerEvents: 'auto',
          }}
        >
          {!showArchiveReasons ? (
            <button
              onClick={() => setShowArchiveReasons(true)}
              disabled={loading}
              className="w-full h-full flex items-center justify-center"
            />
          ) : (
            <select
              onChange={e => handleArchiveWithReason(e.target.value)}
              disabled={loading}
              className="w-full h-full text-center text-[10px]"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontWeight: 'bold',
              }}
              autoFocus
            >
              <option value="" style={{ color: 'black' }}>
                Raison
              </option>
              {ARCHIVE_REASONS.map(r => (
                <option key={r.value} value={r.value} style={{ color: 'black' }}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {swipeX > 100 && (
        <div className="absolute right-0 top-0 h-full flex" style={{ zIndex: 30, pointerEvents: 'none' }}>
          <button
            onClick={handleQuickCall}
            disabled={loading}
            className="flex-1 flex items-center justify-center"
            style={{
              width: '80px',
              pointerEvents: 'auto',
            }}
          />
          <button
            onClick={handleNextStatut}
            disabled={loading}
            className="flex-1 flex items-center justify-center"
            style={{
              width: '80px',
              pointerEvents: 'auto',
            }}
          />
        </div>
      )}
    </div>
  )
}

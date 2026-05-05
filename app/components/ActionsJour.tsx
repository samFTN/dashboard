'use client'

import { useState } from 'react'
import Link from 'next/link'

type Action = {
  id: string
  nom: string
  telephone: string | null
  statut: string
  prochaine_action_type: string
  prochaine_action_date: string
  prochaine_action_note: string | null
}

const ACTION_LABELS: Record<string, string> = { appel: 'Appel', sms: 'SMS', cours_essai: "Cours d'essai" }
const ACTION_COLORS: Record<string, string> = { appel: '#1d4ed8', sms: '#15803d', cours_essai: '#d97706' }

export default function ActionsJour({ actions }: { actions: Action[] }) {
  const [confirming, setConfirming] = useState<string | null>(null)

  if (actions.length === 0) return null

  return (
    <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: '2px solid var(--accent)', background: 'var(--card)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--accent)' }}>
        <p className="text-sm font-black uppercase tracking-wider text-white">
          {actions.length} action{actions.length > 1 ? 's' : ''} à faire aujourd&apos;hui
        </p>
        <span className="text-white text-lg font-black">{actions.length}</span>
      </div>
      <div>
        {actions.map((a, i) => {
          const retard = new Date(a.prochaine_action_date) < new Date(new Date().toDateString())
          return (
            <Link
              key={a.id}
              href={`/leads?id=${a.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:opacity-75 transition-opacity"
              style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
            >
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                style={{ background: ACTION_COLORS[a.prochaine_action_type] + '20', color: ACTION_COLORS[a.prochaine_action_type] }}
              >
                {ACTION_LABELS[a.prochaine_action_type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--dark)' }}>{a.nom}</p>
                {a.prochaine_action_note && (
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>{a.prochaine_action_note}</p>
                )}
              </div>
              <div className="text-right shrink-0" onClick={e => e.preventDefault()}>
                {a.telephone && (
                  confirming === a.id ? (
                    <a
                      href={`tel:${a.telephone.replace(/\s/g, '')}`}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{ background: '#d97706', color: 'white' }}
                      onClick={e => e.stopPropagation()}
                    >
                      Appeler ?
                    </a>
                  ) : (
                    <button
                      className="text-xs font-semibold"
                      style={{ color: 'var(--dark)' }}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(a.id) }}
                    >
                      {a.telephone}
                    </button>
                  )
                )}
                {retard && (
                  <p className="text-[10px] font-bold mt-0.5" style={{ color: '#dc2626' }}>En retard</p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

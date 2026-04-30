'use client'

import { useState } from 'react'
import ElevePanel from './ElevePanel'

export type EleveRow = {
  id: string
  nom: string
  email: string
  telephone: string | null
  formule: string
  duree_contractuelle_mois: number
  date_debut: string
  date_fin_prevue: string
  actif: boolean
  mode_paiement: string
  montant_total: number
  nb_echeances: number
  semaines_freeze_consommees: number
  freeze_actif: boolean
  objectifs: string
  points_total: number
  lead_id: string | null
  prof_dedie_id: string
  created_at: string
  nb_seances_realisees: number
  has_alerte: boolean
  satisfaction_moyenne: string | null
}

const FORMULE_LABELS: Record<string, string> = {
  programme_4_mois: '4 mois',
  programme_12_mois: '12 mois',
}

function satisfactionColor(val: string | null) {
  if (!val) return 'var(--muted)'
  const n = parseFloat(val)
  if (n >= 4) return '#16a34a'
  if (n >= 3) return '#d4a017'
  return '#dc2626'
}

function AvancementBar({ seances, mois }: { seances: number; mois: number }) {
  const total = mois * 2
  const pct = Math.min(100, Math.round((seances / total) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? '#16a34a' : pct >= 40 ? 'var(--accent)' : 'var(--muted)',
          }}
        />
      </div>
      <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>
        {seances}/{total}
      </span>
    </div>
  )
}

export default function ElevesClient({
  initialActifs,
  initialAnciens,
}: {
  initialActifs: EleveRow[]
  initialAnciens: EleveRow[]
}) {
  const [tab, setTab] = useState<'actifs' | 'anciens'>('actifs')
  const [actifs, setActifs] = useState<EleveRow[]>(initialActifs)
  const [anciens, setAnciens] = useState<EleveRow[]>(initialAnciens)
  const [selected, setSelected] = useState<EleveRow | null>(null)

  const list = tab === 'actifs' ? actifs : anciens

  function handleEleveChanged(id: string, changes: Partial<EleveRow>) {
    const update = (prev: EleveRow[]) =>
      prev.map(e => e.id === id ? { ...e, ...changes } : e)
    setActifs(update)
    setAnciens(update)
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...changes } : prev)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--dark)', letterSpacing: '-0.5px' }}>
              Élèves
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted2)' }}>
              {actifs.length} actif{actifs.length !== 1 ? 's' : ''} · {anciens.length} ancien{anciens.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1.5px solid var(--border)' }}>
            {([
              { label: 'Actifs', value: 'actifs' as const },
              { label: 'Anciens', value: 'anciens' as const },
            ]).map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className="px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: tab === value ? 'var(--dark)' : 'transparent',
                  color: tab === value ? 'white' : 'var(--muted2)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-5">
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['Nom', 'Formule', 'Avancement', 'Satisfaction', 'Points', 'Alerte'].map(col => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--muted2)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
                    Aucun élève
                  </td>
                </tr>
              ) : (
                list.map((e, i) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--border2)' : undefined,
                      background: selected?.id === e.id ? 'var(--accent-soft)' : undefined,
                    }}
                    onMouseEnter={ev => {
                      if (selected?.id !== e.id)
                        ev.currentTarget.style.background = 'var(--bg)'
                    }}
                    onMouseLeave={ev => {
                      if (selected?.id !== e.id)
                        ev.currentTarget.style.background = ''
                    }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: 'var(--dark)' }}>{e.nom}</p>
                      {e.freeze_actif && (
                        <span
                          className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold mt-0.5"
                          style={{ background: '#eff6ff', color: '#2563eb' }}
                        >
                          FREEZE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted2)' }}>
                      {FORMULE_LABELS[e.formule] ?? e.formule}
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: 140 }}>
                      <AvancementBar seances={e.nb_seances_realisees} mois={e.duree_contractuelle_mois} />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: satisfactionColor(e.satisfaction_moyenne) }}>
                      {e.satisfaction_moyenne ? `${e.satisfaction_moyenne}/5` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                      {e.points_total ?? 0} pts
                    </td>
                    <td className="px-4 py-3">
                      {e.has_alerte ? (
                        <span
                          className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold"
                          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                        >
                          ⚠ Alerte
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel */}
      {selected && (
        <ElevePanel
          eleve={selected}
          onClose={() => setSelected(null)}
          onChanged={(changes) => handleEleveChanged(selected.id, changes)}
        />
      )}
    </div>
  )
}

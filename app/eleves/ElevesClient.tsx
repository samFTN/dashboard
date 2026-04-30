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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: pct >= 80 ? '#16a34a' : pct >= 40 ? 'var(--accent)' : 'var(--muted)',
          borderRadius: 3, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
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
  const setList = tab === 'actifs' ? setActifs : setAnciens

  function handleEleveChanged(id: string, changes: Partial<EleveRow>) {
    const update = (prev: EleveRow[]) =>
      prev.map(e => e.id === id ? { ...e, ...changes } : e)
    setActifs(update)
    setAnciens(update)
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...changes } : prev)
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)', margin: 0 }}>Élèves</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            {actifs.length} actif{actifs.length !== 1 ? 's' : ''} · {anciens.length} ancien{anciens.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['actifs', 'anciens'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
              background: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--muted)', marginBottom: -1,
            }}
          >
            {t === 'actifs' ? 'Actifs' : 'Anciens'} ({t === 'actifs' ? actifs.length : anciens.length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--border2)', borderBottom: '1px solid var(--border)' }}>
              {['Nom', 'Formule', 'Avancement', 'Satisfaction', 'Points', 'Alerte'].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Aucun élève
                </td>
              </tr>
            )}
            {list.map((e, i) => (
              <tr
                key={e.id}
                onClick={() => setSelected(e)}
                style={{
                  borderBottom: i < list.length - 1 ? '1px solid var(--border2)' : 'none',
                  cursor: 'pointer',
                  background: selected?.id === e.id ? 'var(--accent-soft)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={ev => { if (selected?.id !== e.id) ev.currentTarget.style.background = 'var(--border2)' }}
                onMouseLeave={ev => { if (selected?.id !== e.id) ev.currentTarget.style.background = 'transparent' }}
              >
                <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--dark)' }}>
                  <div>{e.nom}</div>
                  {e.freeze_actif && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: '#2563eb',
                      background: '#eff6ff', padding: '1px 6px', borderRadius: 4,
                    }}>
                      FREEZE
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                  {FORMULE_LABELS[e.formule] ?? e.formule}
                </td>
                <td style={{ padding: '12px 16px', minWidth: 140 }}>
                  <AvancementBar seances={e.nb_seances_realisees} mois={e.duree_contractuelle_mois} />
                </td>
                <td style={{ padding: '12px 16px', color: satisfactionColor(e.satisfaction_moyenne), fontWeight: 600 }}>
                  {e.satisfaction_moyenne ? `${e.satisfaction_moyenne}/5` : '—'}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--accent)' }}>
                  {e.points_total ?? 0} pts
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {e.has_alerte ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#dc2626',
                      background: '#fef2f2', padding: '3px 8px', borderRadius: 4,
                      border: '1px solid #fecaca',
                    }}>
                      ⚠ Alerte
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

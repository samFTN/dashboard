'use client'

import { useState } from 'react'
import ElevePanel from './ElevePanel'
import ImportCSVModal from './ImportCSVModal'
import Avatar from './Avatar'

export type EleveRow = {
  id: string
  nom: string
  email: string
  telephone: string | null
  formule: string
  formule_label: string
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
  notes: string
  points_total: number
  lead_id: string | null
  prof_dedie_id: string
  created_at: string
  nb_seances_prevues: number
  nb_seances_realisees: number
  has_alerte: boolean
  satisfaction_moyenne: number | null
  photo_url: string | null
}

function satisfactionColor(val: number | null) {
  if (!val) return 'var(--muted)'
  if (val >= 4) return '#16a34a'
  if (val >= 3) return '#d4a017'
  return '#dc2626'
}

function AvancementBar({ seances, total }: { seances: number; total: number }) {
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
  todayCount,
  googleConnected,
}: {
  initialActifs: EleveRow[]
  initialAnciens: EleveRow[]
  todayCount: number
  googleConnected: boolean
}) {
  const [tab, setTab] = useState<'actifs' | 'anciens'>('actifs')
  const [actifs, setActifs] = useState<EleveRow[]>(initialActifs)
  const [anciens, setAnciens] = useState<EleveRow[]>(initialAnciens)
  const [selected, setSelected] = useState<EleveRow | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  async function syncPhotos() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/auth/google/sync-photos', { method: 'POST' })
      const data = await res.json() as { updated: number; total: number }
      setSyncMsg(`${data.updated} photo${data.updated > 1 ? 's' : ''} récupérée${data.updated > 1 ? 's' : ''} sur ${data.total} élève${data.total > 1 ? 's' : ''}`)
      if (data.updated > 0) window.location.reload()
    } catch {
      setSyncMsg('Erreur lors de la synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  const list = tab === 'actifs' ? actifs : anciens

  function handleEleveChanged(id: string, changes: Partial<EleveRow>) {
    if (changes.actif === false) {
      const eleve = actifs.find(e => e.id === id)
      if (eleve) {
        setActifs(prev => prev.filter(e => e.id !== id))
        setAnciens(prev => [{ ...eleve, ...changes }, ...prev])
      }
    } else {
      const update = (prev: EleveRow[]) =>
        prev.map(e => e.id === id ? { ...e, ...changes } : e)
      setActifs(update)
      setAnciens(update)
    }
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...changes } : prev)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-8 pt-6 md:pt-8 pb-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--dark)', letterSpacing: '-0.5px' }}>
              Élèves
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm" style={{ color: 'var(--muted2)' }}>
                {actifs.length} actif{actifs.length !== 1 ? 's' : ''} · {anciens.length} ancien{anciens.length !== 1 ? 's' : ''}
              </p>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={todayCount > 0
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                  : { background: 'var(--border)', color: 'var(--muted)' }}
              >
                {todayCount > 0 && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--accent)' }} />}
                {`${todayCount} aujourd'hui`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!googleConnected ? (
              <a
                href="/api/auth/google"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: '#4285f4', color: 'white' }}
              >
                Connecter Google
              </a>
            ) : (
              <button
                onClick={syncPhotos}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: '#4285f4', color: 'white', opacity: syncing ? 0.6 : 1 }}
              >
                {syncing ? 'Sync…' : '↻ Photos Google'}
              </button>
            )}
            {syncMsg && (
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{syncMsg}</span>
            )}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--dark)', color: 'white' }}
            >
              <span>↑</span> Importer CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Bandeau actions */}
      {tab === 'actifs' && (() => {
        const alerteCount = actifs.filter(e => e.has_alerte).length
        const freezeCount = actifs.filter(e => e.freeze_actif).length
        if (alerteCount === 0 && freezeCount === 0) return null
        return (
          <div className="px-4 md:px-8 pt-3">
            <div className="flex items-center gap-2 flex-wrap rounded-xl px-4 py-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>À faire</span>
              {alerteCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                  {`⚠ ${alerteCount} élève${alerteCount > 1 ? 's' : ''} — CR manquant`}
                </span>
              )}
              {freezeCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                  {`⏸ ${freezeCount} élève${freezeCount > 1 ? 's' : ''} en freeze`}
                </span>
              )}
            </div>
          </div>
        )
      })()}

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-5">
        <div
          className="rounded-2xl overflow-hidden overflow-x-auto"
          style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <table className="w-full text-sm border-collapse" style={{ minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['Nom', 'Formule', 'Avancement', 'Satisfaction', 'Points', 'Alerte', 'Notes'].map(col => (
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
                  <td colSpan={7} className="px-4 py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
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
                      <div className="flex items-center gap-2">
                        <Avatar photoUrl={e.photo_url} nom={e.nom} size={32} />
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--dark)' }}>{e.nom}</p>
                          {e.freeze_actif && (
                            <span
                              className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold mt-0.5"
                              style={{ background: '#eff6ff', color: '#2563eb' }}
                            >
                              FREEZE
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted2)' }}>
                      {e.formule_label}
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: 140 }}>
                      <AvancementBar seances={e.nb_seances_realisees} total={e.nb_seances_prevues ?? e.duree_contractuelle_mois * 2} />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: satisfactionColor(e.satisfaction_moyenne) }}>
                      {e.satisfaction_moyenne != null ? `${e.satisfaction_moyenne}/5` : '—'}
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
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)', maxWidth: 200 }}>
                      {e.notes ? (
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {e.notes}
                        </span>
                      ) : '—'}
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

      {/* Import CSV */}
      {showImport && (
        <ImportCSVModal
          eleves={[...actifs, ...anciens]}
          onClose={() => setShowImport(false)}
          onImported={(eleveId, nbSeances) => {
            // Met à jour le compteur de séances de l'élève dans la liste
            if (nbSeances > 0) {
              handleEleveChanged(eleveId, {
                nb_seances_realisees: (actifs.find(e => e.id === eleveId) ?? anciens.find(e => e.id === eleveId))!.nb_seances_realisees + nbSeances,
              })
            }
          }}
        />
      )}
    </div>
  )
}

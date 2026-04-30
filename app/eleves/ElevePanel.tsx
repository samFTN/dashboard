'use client'

import { useEffect, useRef, useState } from 'react'
import type { EleveRow } from './ElevesClient'

type VoletProf = {
  presence: boolean
  remarque: string | null
  nb_ateliers_assistes: number
  nb_commentaires: number
  nb_videos_feedback: number
  video_defi: boolean
  defi_valide: boolean
  points_jeux: number
}

type VoletEleve = {
  satisfaction: number | null
  ressenti: string | null
  participation_ateliers: string | null
  date_remplissage: string | null
}

type Seance = {
  id: string
  date: string
  numero_seance: number
  alerte_decrochage: boolean
  volet_prof: VoletProf | null
  volet_eleve: VoletEleve | null
}

type Freeze = {
  id: string
  date_debut: string
  date_fin: string | null
  semaines_duree: number | null
}

type EleveDetail = EleveRow & {
  seances: Seance[]
  freezes: Freeze[]
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
        letterSpacing: 0.8, marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, marginRight: 12 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--dark)', textAlign: 'right', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function SeanceCard({
  seance,
  eleveId,
  onUpdated,
}: {
  seance: Seance
  eleveId: string
  onUpdated: (s: Seance) => void
}) {
  const [openProf, setOpenProf] = useState(false)
  const [openEleve, setOpenEleve] = useState(false)
  const [profForm, setProfForm] = useState<Partial<VoletProf>>(seance.volet_prof ?? {})
  const [eleveForm, setEleveForm] = useState<Partial<VoletEleve>>(seance.volet_eleve ?? {})
  const [savingProf, setSavingProf] = useState(false)
  const [savingEleve, setSavingEleve] = useState(false)

  async function saveProf() {
    setSavingProf(true)
    try {
      await fetch(`/api/eleves/${eleveId}/seances/${seance.id}/volet-prof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presence: true, ...profForm }),
      })
      onUpdated({ ...seance, volet_prof: { presence: true, remarque: null, nb_ateliers_assistes: 0, nb_commentaires: 0, nb_videos_feedback: 0, video_defi: false, defi_valide: false, points_jeux: 0, ...profForm } as VoletProf })
      setOpenProf(false)
    } finally {
      setSavingProf(false)
    }
  }

  async function saveEleve() {
    setSavingEleve(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const payload = { ...eleveForm, date_remplissage: today }
      await fetch(`/api/eleves/${eleveId}/seances/${seance.id}/volet-eleve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onUpdated({
        ...seance,
        alerte_decrochage: false,
        volet_eleve: { satisfaction: null, ressenti: null, participation_ateliers: null, date_remplissage: today, ...eleveForm } as VoletEleve,
      })
      setOpenEleve(false)
    } finally {
      setSavingEleve(false)
    }
  }

  const alerteActive = seance.alerte_decrochage && !seance.volet_eleve?.date_remplissage

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden',
      borderLeft: alerteActive ? '3px solid #dc2626' : '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', background: 'var(--border2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dark)' }}>
            Séance #{seance.numero_seance}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fmt(seance.date)}</span>
          {alerteActive && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 6px', borderRadius: 4 }}>
              ⚠ CR manquant
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {seance.volet_prof && (
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
              {seance.volet_prof.points_jeux}pts
            </span>
          )}
        </div>
      </div>

      {/* Volet prof */}
      <div style={{ borderTop: '1px solid var(--border2)' }}>
        <button
          onClick={() => setOpenProf(v => !v)}
          style={{
            width: '100%', padding: '8px 12px', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 12, color: 'var(--muted)',
          }}
        >
          <span>Volet prof {seance.volet_prof ? `✓ (${seance.volet_prof.points_jeux} pts)` : '—'}</span>
          <span>{openProf ? '▲' : '▼'}</span>
        </button>
        {openProf && (
          <div style={{ padding: '0 12px 12px', fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={profForm.presence ?? false}
                onChange={e => setProfForm(p => ({ ...p, presence: e.target.checked }))}
              />
              Présent
            </label>
            {[
              ['nb_ateliers_assistes', 'Ateliers suivis'],
              ['nb_commentaires', 'Commentaires'],
              ['nb_videos_feedback', 'Vidéos feedback'],
              ['points_jeux', 'Points Jeux™'],
            ].map(([key, label]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <input
                  type="number" min={0}
                  value={(profForm as Record<string, number>)[key] ?? 0}
                  onChange={e => setProfForm(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                  style={{ width: 60, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, textAlign: 'right' }}
                />
              </div>
            ))}
            {[
              ['video_defi', 'Vidéo défi'],
              ['defi_valide', 'Défi validé'],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={(profForm as Record<string, boolean>)[key] ?? false}
                  onChange={e => setProfForm(p => ({ ...p, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
            <textarea
              placeholder="Remarque..."
              value={profForm.remarque ?? ''}
              onChange={e => setProfForm(p => ({ ...p, remarque: e.target.value }))}
              rows={2}
              style={{
                width: '100%', padding: '6px 8px', border: '1px solid var(--border)',
                borderRadius: 4, fontSize: 12, resize: 'vertical', marginBottom: 8,
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={saveProf} disabled={savingProf}
              style={{
                padding: '6px 14px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              {savingProf ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      {/* Volet élève */}
      <div style={{ borderTop: '1px solid var(--border2)' }}>
        <button
          onClick={() => setOpenEleve(v => !v)}
          style={{
            width: '100%', padding: '8px 12px', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 12, color: 'var(--muted)',
          }}
        >
          <span>Volet élève {seance.volet_eleve?.date_remplissage ? `✓ (${new Date(seance.volet_eleve.date_remplissage).toLocaleDateString('fr-FR')})` : '—'}</span>
          <span>{openEleve ? '▲' : '▼'}</span>
        </button>
        {openEleve && (
          <div style={{ padding: '0 12px 12px', fontSize: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Satisfaction (1-5)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setEleveForm(p => ({ ...p, satisfaction: n }))}
                    style={{
                      width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 6,
                      background: eleveForm.satisfaction === n ? 'var(--accent)' : 'var(--card)',
                      color: eleveForm.satisfaction === n ? '#fff' : 'var(--text)',
                      cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              placeholder="Ressenti..."
              value={eleveForm.ressenti ?? ''}
              onChange={e => setEleveForm(p => ({ ...p, ressenti: e.target.value }))}
              rows={2}
              style={{
                width: '100%', padding: '6px 8px', border: '1px solid var(--border)',
                borderRadius: 4, fontSize: 12, resize: 'vertical', marginBottom: 8,
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <textarea
              placeholder="Participation ateliers / vidéos..."
              value={eleveForm.participation_ateliers ?? ''}
              onChange={e => setEleveForm(p => ({ ...p, participation_ateliers: e.target.value }))}
              rows={2}
              style={{
                width: '100%', padding: '6px 8px', border: '1px solid var(--border)',
                borderRadius: 4, fontSize: 12, resize: 'vertical', marginBottom: 8,
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={saveEleve} disabled={savingEleve}
              style={{
                padding: '6px 14px', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              {savingEleve ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ElevePanel({
  eleve,
  onClose,
  onChanged,
}: {
  eleve: EleveRow
  onClose: () => void
  onChanged: (changes: Partial<EleveRow>) => void
}) {
  const [detail, setDetail] = useState<EleveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [ajoutSeance, setAjoutSeance] = useState(false)
  const [newSeanceDate, setNewSeanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [freezeLoading, setFreezeLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/eleves/${eleve.id}`)
      .then(r => r.json())
      .then(data => {
        setDetail(data)
        setLoading(false)
      })
  }, [eleve.id])

  async function addSeance() {
    if (!newSeanceDate) return
    const res = await fetch(`/api/eleves/${eleve.id}/seances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newSeanceDate }),
    })
    const seance = await res.json()
    setDetail(prev => prev ? { ...prev, seances: [seance, ...prev.seances] } : prev)
    onChanged({ nb_seances_realisees: (eleve.nb_seances_realisees ?? 0) + 1 })
    setAjoutSeance(false)
  }

  async function toggleFreeze() {
    if (!detail) return
    setFreezeLoading(true)
    try {
      const action = detail.freeze_actif ? 'end' : 'start'
      const res = await fetch(`/api/eleves/${eleve.id}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        // Recharger le détail
        const data = await fetch(`/api/eleves/${eleve.id}`).then(r => r.json())
        setDetail(data)
        onChanged({
          freeze_actif: data.freeze_actif,
          date_fin_prevue: data.date_fin_prevue,
          semaines_freeze_consommees: data.semaines_freeze_consommees,
        })
      }
    } finally {
      setFreezeLoading(false)
    }
  }

  function updateSeance(updated: Seance) {
    setDetail(prev => {
      if (!prev) return prev
      const seances = prev.seances.map(s => s.id === updated.id ? updated : s)
      const hasAlerte = seances.some(s => s.alerte_decrochage && !s.volet_eleve?.date_remplissage)
      const totalPoints = seances.reduce((acc, s) => acc + (s.volet_prof?.points_jeux ?? 0), 0)
      onChanged({ has_alerte: hasAlerte, points_total: totalPoints })
      return { ...prev, seances }
    })
  }

  const MODE_LABELS: Record<string, string> = {
    cb_2x: 'CB 2×', cb_3x: 'CB 3×', cb_4x: 'CB 4×', paypal_4x: 'PayPal 4×',
  }

  const FORMULE_LABELS: Record<string, string> = {
    programme_4_mois: 'Programme 4 mois',
    programme_12_mois: 'Programme 12 mois',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
          background: 'var(--card)', zIndex: 50, display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          position: 'sticky', top: 0, background: 'var(--card)', zIndex: 10,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--dark)' }}>
              {eleve.nom}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {eleve.email}{eleve.telephone ? ` · ${eleve.telephone}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--muted)', lineHeight: 1, padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', flex: 1 }}>
          {/* Objectifs */}
          {eleve.objectifs && (
            <div style={{
              background: 'var(--accent-soft)', border: '1px solid #fde68a',
              borderRadius: 8, padding: '12px 14px', marginBottom: 24,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Objectifs
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--dark)', lineHeight: 1.5 }}>
                {eleve.objectifs}
              </p>
            </div>
          )}

          {/* Programme */}
          <Section title="Programme">
            <Row label="Formule" value={FORMULE_LABELS[eleve.formule] ?? eleve.formule} />
            <Row label="Début" value={fmt(eleve.date_debut)} />
            <Row label="Fin prévue" value={fmt(eleve.date_fin_prevue)} />
            <Row label="Paiement" value={`${MODE_LABELS[eleve.mode_paiement] ?? eleve.mode_paiement} · ${eleve.montant_total} €`} />
            <Row label="Prof" value={eleve.prof_dedie_id} />
          </Section>

          {/* Stats */}
          <Section title="Suivi">
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div style={{
                flex: 1, background: 'var(--border2)', borderRadius: 8, padding: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)' }}>
                  {eleve.nb_seances_realisees}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>séances</div>
              </div>
              <div style={{
                flex: 1, background: 'var(--border2)', borderRadius: 8, padding: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                  {eleve.points_total ?? 0}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>points Jeux™</div>
              </div>
              {eleve.satisfaction_moyenne && (
                <div style={{
                  flex: 1, background: 'var(--border2)', borderRadius: 8, padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>
                    {eleve.satisfaction_moyenne}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>satisfaction</div>
                </div>
              )}
            </div>
          </Section>

          {/* Freeze */}
          <Section title="Freeze">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--dark)', fontWeight: 500 }}>
                  {eleve.freeze_actif ? '⏸ Freeze actif' : 'Aucun freeze actif'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {eleve.semaines_freeze_consommees} sem. consommée{eleve.semaines_freeze_consommees !== 1 ? 's' : ''} / 4
                </div>
              </div>
              <button
                onClick={toggleFreeze}
                disabled={freezeLoading || (!eleve.freeze_actif && eleve.semaines_freeze_consommees >= 4)}
                style={{
                  padding: '6px 14px', border: '1px solid var(--border)',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: eleve.freeze_actif ? '#fef2f2' : 'var(--card)',
                  color: eleve.freeze_actif ? '#dc2626' : 'var(--text)',
                  opacity: (!eleve.freeze_actif && eleve.semaines_freeze_consommees >= 4) ? 0.4 : 1,
                }}
              >
                {freezeLoading ? '...' : eleve.freeze_actif ? 'Terminer le freeze' : 'Démarrer un freeze'}
              </button>
            </div>
            {detail && detail.freezes.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {detail.freezes.map(f => (
                  <div key={f.id} style={{ marginBottom: 2 }}>
                    {fmt(f.date_debut)} → {f.date_fin ? fmt(f.date_fin) : 'en cours'}
                    {f.semaines_duree ? ` (${f.semaines_duree} sem.)` : ''}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Séances */}
          <Section title={`Séances (${detail?.seances.length ?? '…'})`}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              {!ajoutSeance ? (
                <button
                  onClick={() => setAjoutSeance(true)}
                  style={{
                    padding: '6px 14px', background: 'var(--accent)', color: '#fff',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}
                >
                  + Nouvelle séance
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="date"
                    value={newSeanceDate}
                    onChange={e => setNewSeanceDate(e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                  />
                  <button
                    onClick={addSeance}
                    style={{
                      padding: '6px 12px', background: 'var(--accent)', color: '#fff',
                      border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    Créer
                  </button>
                  <button
                    onClick={() => setAjoutSeance(false)}
                    style={{
                      padding: '6px 12px', background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>

            {loading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chargement...</div>}

            {!loading && detail && detail.seances.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Aucune séance enregistrée.</div>
            )}

            {detail && detail.seances.map(s => (
              <SeanceCard
                key={s.id}
                seance={s}
                eleveId={eleve.id}
                onUpdated={updateSeance}
              />
            ))}
          </Section>
        </div>
      </div>
    </>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import type { EleveRow } from './ElevesClient'
import { ContactActions } from '@/app/components/ContactActions'
import Avatar from './Avatar'

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

type Echeance = {
  id: string
  date_prelevement: string
  montant: number
  encaisse: boolean
  date_encaissement: string | null
}

type EleveDetail = EleveRow & {
  seances: Seance[]
  freezes: Freeze[]
  echeances: Echeance[]
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
  onDeleted,
}: {
  seance: Seance
  eleveId: string
  onUpdated: (s: Seance) => void
  onDeleted: (id: string) => void
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {seance.volet_prof && (
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
              {seance.volet_prof.points_jeux}pts
            </span>
          )}
          <button
            onClick={async () => {
              if (!confirm(`Supprimer la séance #${seance.numero_seance} ?`)) return
              const res = await fetch(`/api/eleves/${eleveId}/seances/${seance.id}`, { method: 'DELETE' })
              if (res.ok) onDeleted(seance.id)
            }}
            style={{
              fontSize: 11, padding: '1px 7px', background: 'none',
              border: '1px solid var(--border)', borderRadius: 4,
              cursor: 'pointer', color: 'var(--muted)',
            }}
          >
            ×
          </button>
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

type EditForm = {
  nom: string
  email: string
  telephone: string
  formule: string
  duree_contractuelle_mois: string
  nb_seances_prevues: string
  date_debut: string
  date_fin_prevue: string
  mode_paiement: string
  montant_total: string
  nb_echeances: string
  prof_dedie_id: string
  objectifs: string
  notes: string
}

function addMonthsToDate(isoDate: string, months: number): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

type Formule = { id: string; label: string; duree_mois: number }
type Prof = { id: string; nom: string }

const MODE_LABELS: Record<string, string> = {
  cb_1x: 'CB 1×', cb_2x: 'CB 2×', cb_3x: 'CB 3×', cb_4x: 'CB 4×', paypal_4x: 'PayPal 4×',
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
  const [editMode, setEditMode] = useState(false)
  const [formules, setFormules] = useState<Formule[]>([])
  const [profs, setProfs] = useState<Prof[]>([])
  const [showGererFormules, setShowGererFormules] = useState(false)
  const [showGererProfs, setShowGererProfs] = useState(false)
  const [newFormule, setNewFormule] = useState({ label: '', duree_mois: '4' })
  const [newProfNom, setNewProfNom] = useState('')
  const [confirmDeleteFormule, setConfirmDeleteFormule] = useState<string | null>(null)
  const [confirmDeleteProf, setConfirmDeleteProf] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    nom: eleve.nom,
    email: eleve.email ?? '',
    telephone: eleve.telephone ?? '',
    formule: eleve.formule,
    duree_contractuelle_mois: String(eleve.duree_contractuelle_mois ?? 4),
    nb_seances_prevues: String(eleve.nb_seances_prevues ?? (eleve.duree_contractuelle_mois ?? 4) * 2),
    date_debut: eleve.date_debut?.slice(0, 10) ?? '',
    date_fin_prevue: eleve.date_fin_prevue?.slice(0, 10) ?? '',
    mode_paiement: eleve.mode_paiement,
    montant_total: String(eleve.montant_total ?? ''),
    nb_echeances: String(eleve.nb_echeances ?? ''),
    prof_dedie_id: eleve.prof_dedie_id ?? '',
    objectifs: eleve.objectifs ?? '',
    notes: eleve.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ancienLoading, setAncienLoading] = useState(false)
  const [noteText, setNoteText] = useState(eleve.notes ?? '')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/formules').then(r => r.json()).then(setFormules)
    fetch('/api/profs').then(r => r.json()).then(setProfs)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/eleves/${eleve.id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setDetail(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('[ElevePanel fetch]', err)
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

  function deleteSeance(sid: string) {
    setDetail(prev => {
      if (!prev) return prev
      const seances = prev.seances.filter(s => s.id !== sid)
      const hasAlerte = seances.some(s => s.alerte_decrochage && !s.volet_eleve?.date_remplissage)
      const totalPoints = seances.reduce((acc, s) => acc + (s.volet_prof?.points_jeux ?? 0), 0)
      onChanged({ nb_seances_realisees: seances.length, has_alerte: hasAlerte, points_total: totalPoints })
      return { ...prev, seances }
    })
  }

  async function addFormule() {
    if (!newFormule.label.trim()) return
    const res = await fetch('/api/formules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newFormule.label, duree_mois: parseInt(newFormule.duree_mois) }),
    })
    const f = await res.json()
    setFormules(prev => [...prev, f])
    setNewFormule({ label: '', duree_mois: '4' })
  }

  async function deleteFormule(id: string) {
    await fetch(`/api/formules/${id}`, { method: 'DELETE' })
    setFormules(prev => prev.filter(f => f.id !== id))
    setConfirmDeleteFormule(null)
  }

  async function saveNote(value: string) {
    if (value === (eleve.notes ?? '')) return
    setNoteSaving(true)
    try {
      await fetch(`/api/eleves/${eleve.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value }),
      })
      onChanged({ notes: value })
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 2000)
    } finally {
      setNoteSaving(false)
    }
  }

  async function marquerAncien() {
    if (!confirm('Marquer cet élève comme ancien élève ?')) return
    setAncienLoading(true)
    try {
      await fetch(`/api/eleves/${eleve.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: false }),
      })
      onChanged({ actif: false })
      onClose()
    } finally {
      setAncienLoading(false)
    }
  }

  async function saveEdit() {
    setSaving(true)
    setSaveError(null)
    try {
      const body = {
        nom: editForm.nom.trim(),
        email: editForm.email.trim() || null,
        telephone: editForm.telephone.trim() || null,
        formule: editForm.formule,
        duree_contractuelle_mois: parseInt(editForm.duree_contractuelle_mois) || 4,
        nb_seances_prevues: parseInt(editForm.nb_seances_prevues) || null,
        date_debut: editForm.date_debut || null,
        date_fin_prevue: editForm.date_fin_prevue || null,
        mode_paiement: editForm.mode_paiement,
        montant_total: parseFloat(editForm.montant_total) || null,
        nb_echeances: parseInt(editForm.nb_echeances) || null,
        prof_dedie_id: editForm.prof_dedie_id.trim() || null,
        objectifs: editForm.objectifs.trim() || null,
        notes: editForm.notes.trim(),
      }
      const res = await fetch(`/api/eleves/${eleve.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }
      const formule_label = formules.find(f => f.id === editForm.formule)?.label ?? editForm.formule
      onChanged({ ...(body as Partial<EleveRow>), formule_label })
      onClose()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
      setSaving(false)
    }
  }

  async function addProf() {
    if (!newProfNom.trim()) return
    const res = await fetch('/api/profs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: newProfNom }),
    })
    const p = await res.json()
    setProfs(prev => [...prev, p].sort((a, b) => a.nom.localeCompare(b.nom)))
    setNewProfNom('')
  }

  async function deleteProf(id: string) {
    await fetch(`/api/profs/${id}`, { method: 'DELETE' })
    setProfs(prev => prev.filter(p => p.id !== id))
    setConfirmDeleteProf(null)
  }

  function getFormuleLabel(id: string) {
    return formules.find(f => f.id === id)?.label ?? id
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
        className="panel-slide-wide"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar gravatarUrl={eleve.gravatar_url} nom={eleve.nom} size={48} />
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--dark)' }}>
                {editMode ? editForm.nom || eleve.nom : eleve.nom}
              </h2>
              <ContactActions
                email={eleve.email}
                telephone={eleve.telephone ?? undefined}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!editMode && eleve.actif && (
              <button
                onClick={marquerAncien}
                disabled={ancienLoading}
                style={{
                  fontSize: 12, padding: '5px 12px', border: '1px solid var(--border)',
                  borderRadius: 6, cursor: 'pointer', background: 'none', color: 'var(--muted2)',
                  fontWeight: 500, opacity: ancienLoading ? 0.6 : 1,
                }}
              >
                {ancienLoading ? '...' : 'Ancien élève'}
              </button>
            )}
            {!editMode ? (
              <button
                onClick={() => {
                  setEditForm({
                    nom: eleve.nom,
                    email: eleve.email ?? '',
                    telephone: eleve.telephone ?? '',
                    formule: eleve.formule,
                    duree_contractuelle_mois: String(eleve.duree_contractuelle_mois ?? 4),
                    nb_seances_prevues: String(eleve.nb_seances_prevues ?? (eleve.duree_contractuelle_mois ?? 4) * 2),
                    date_debut: eleve.date_debut?.slice(0, 10) ?? '',
                    date_fin_prevue: eleve.date_fin_prevue?.slice(0, 10) ?? '',
                    mode_paiement: eleve.mode_paiement,
                    montant_total: String(eleve.montant_total ?? ''),
                    nb_echeances: String(eleve.nb_echeances ?? ''),
                    prof_dedie_id: eleve.prof_dedie_id ?? '',
                    objectifs: eleve.objectifs ?? '',
                    notes: eleve.notes ?? '',
                  })
                  setEditMode(true)
                }}
                style={{
                  fontSize: 12, padding: '5px 12px', border: '1px solid var(--border)',
                  borderRadius: 6, cursor: 'pointer', background: 'none', color: 'var(--muted2)',
                  fontWeight: 500,
                }}
              >
                Modifier
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setEditMode(false); setSaveError(null) }}
                  style={{
                    fontSize: 12, padding: '5px 12px', border: '1px solid var(--border)',
                    borderRadius: 6, cursor: 'pointer', background: 'none', color: 'var(--muted2)',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  style={{
                    fontSize: 12, padding: '5px 12px', border: 'none',
                    borderRadius: 6, cursor: 'pointer', background: 'var(--accent)', color: '#fff',
                    fontWeight: 600, opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </>
            )}
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
        </div>

        {/* Body */}
        <div style={{ padding: '24px', flex: 1 }}>

          {saveError && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, color: '#dc2626' }}>
              {saveError}
            </div>
          )}

          {editMode ? (
            /* ── MODE ÉDITION ── */
            <div style={{ marginBottom: 24 }}>
              {[
                { key: 'nom', label: 'Nom', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'telephone', label: 'Téléphone', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
                  <input
                    type={type}
                    value={(editForm as Record<string, string>)[key]}
                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Formule</label>
                <select value={editForm.formule} onChange={e => setEditForm(p => ({ ...p, formule: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}>
                  {formules.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>

                {/* Gestion des formules */}
                <button
                  type="button"
                  onClick={() => setShowGererFormules(v => !v)}
                  style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  {showGererFormules ? 'Masquer' : 'Gérer les formules'}
                </button>

                {showGererFormules && (
                  <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {formules.map(f => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text)' }}>{f.label} <span style={{ color: 'var(--muted)' }}>({f.duree_mois} mois)</span></span>
                        {confirmDeleteFormule === f.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => deleteFormule(f.id)}
                              style={{ fontSize: 11, padding: '2px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                              Confirmer
                            </button>
                            <button onClick={() => setConfirmDeleteFormule(null)}
                              style={{ fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteFormule(f.id)}
                            style={{ fontSize: 11, padding: '2px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--muted)' }}>
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <input
                        type="text" placeholder="Nom de la formule"
                        value={newFormule.label}
                        onChange={e => setNewFormule(p => ({ ...p, label: e.target.value }))}
                        style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      />
                      <input
                        type="number" min={1} placeholder="mois"
                        value={newFormule.duree_mois}
                        onChange={e => setNewFormule(p => ({ ...p, duree_mois: e.target.value }))}
                        style={{ width: 55, padding: '5px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      />
                      <button onClick={addFormule}
                        style={{ padding: '5px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Durée (mois)</label>
                  <input
                    type="number" min={1}
                    value={editForm.duree_contractuelle_mois}
                    onChange={e => {
                      const mois = parseInt(e.target.value) || 1
                      const newFin = addMonthsToDate(editForm.date_debut, mois)
                      setEditForm(p => ({
                        ...p,
                        duree_contractuelle_mois: String(mois),
                        nb_seances_prevues: String(mois * 2),
                        date_fin_prevue: newFin || p.date_fin_prevue,
                      }))
                    }}
                    style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Séances prévues</label>
                  <input
                    type="number" min={1}
                    value={editForm.nb_seances_prevues}
                    onChange={e => setEditForm(p => ({ ...p, nb_seances_prevues: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date de début</label>
                  <input
                    type="date"
                    value={editForm.date_debut}
                    onChange={e => {
                      const mois = parseInt(editForm.duree_contractuelle_mois) || 4
                      const newFin = addMonthsToDate(e.target.value, mois)
                      setEditForm(p => ({
                        ...p,
                        date_debut: e.target.value,
                        date_fin_prevue: newFin || p.date_fin_prevue,
                      }))
                    }}
                    style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date de fin prévue</label>
                  <input
                    type="date"
                    value={editForm.date_fin_prevue}
                    onChange={e => setEditForm(p => ({ ...p, date_fin_prevue: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mode de paiement</label>
                <select value={editForm.mode_paiement} onChange={e => setEditForm(p => ({ ...p, mode_paiement: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="cb_1x">CB 1×</option>
                  <option value="cb_2x">CB 2×</option>
                  <option value="cb_3x">CB 3×</option>
                  <option value="cb_4x">CB 4×</option>
                  <option value="paypal_4x">PayPal 4×</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Montant total (€)</label>
                  <input type="number" value={editForm.montant_total}
                    onChange={e => setEditForm(p => ({ ...p, montant_total: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nb échéances</label>
                  <input type="number" min={1} max={12} value={editForm.nb_echeances}
                    onChange={e => setEditForm(p => ({ ...p, nb_echeances: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Prof dédié</label>
                <select value={editForm.prof_dedie_id} onChange={e => setEditForm(p => ({ ...p, prof_dedie_id: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">— Aucun —</option>
                  {profs.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>

                <button type="button" onClick={() => setShowGererProfs(v => !v)}
                  style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  {showGererProfs ? 'Masquer' : 'Gérer les profs'}
                </button>

                {showGererProfs && (
                  <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {profs.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text)' }}>{p.nom}</span>
                        {confirmDeleteProf === p.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => deleteProf(p.id)}
                              style={{ fontSize: 11, padding: '2px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                              Confirmer
                            </button>
                            <button onClick={() => setConfirmDeleteProf(null)}
                              style={{ fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteProf(p.id)}
                            style={{ fontSize: 11, padding: '2px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--muted)' }}>
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <input type="text" placeholder="Prénom du prof"
                        value={newProfNom}
                        onChange={e => setNewProfNom(e.target.value)}
                        style={{ flex: 1, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      />
                      <button onClick={addProf}
                        style={{ padding: '5px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Objectifs</label>
                <textarea value={editForm.objectifs} rows={4}
                  onChange={e => setEditForm(p => ({ ...p, objectifs: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes internes</label>
                <textarea value={editForm.notes} rows={3}
                  onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Notes visibles uniquement dans le dashboard..."
                  style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
            </div>
          ) : (
            /* ── MODE LECTURE ── */
            <>
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

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Notes internes
                  </span>
                  <span style={{ fontSize: 11, color: noteSaved ? '#16a34a' : 'transparent', transition: 'color 0.2s' }}>
                    Enregistré ✓
                  </span>
                </div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onBlur={e => saveNote(e.target.value)}
                  placeholder="Ajouter une note interne..."
                  rows={3}
                  disabled={noteSaving}
                  style={{
                    width: '100%', padding: '8px 10px',
                    border: '1.5px solid var(--border)', borderRadius: 7,
                    fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit',
                    resize: 'vertical', background: 'var(--border2)',
                    color: 'var(--dark)', lineHeight: 1.5,
                    outline: 'none', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlurCapture={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>

              <Section title="Programme">
                <Row label="Formule" value={getFormuleLabel(eleve.formule)} />
                <Row label="Début" value={fmt(eleve.date_debut)} />
                <Row label="Fin prévue" value={fmt(eleve.date_fin_prevue)} />
                <Row label="Paiement" value={`${MODE_LABELS[eleve.mode_paiement] ?? eleve.mode_paiement} · ${eleve.montant_total} €`} />
                <Row label="Prof" value={eleve.prof_dedie_id} />
              </Section>
            </>
          )}

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
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                {detail.freezes.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span>
                      {fmt(f.date_debut)} → {f.date_fin ? fmt(f.date_fin) : 'en cours'}
                      {f.semaines_duree ? ` (${f.semaines_duree} sem.)` : ''}
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm('Supprimer ce freeze ?')) return
                        const res = await fetch(`/api/eleves/${eleve.id}/freeze/${f.id}`, { method: 'DELETE' })
                        if (res.ok) {
                          const data = await fetch(`/api/eleves/${eleve.id}`).then(r => r.json())
                          setDetail(data)
                          onChanged({
                            freeze_actif: data.freeze_actif,
                            date_fin_prevue: data.date_fin_prevue,
                            semaines_freeze_consommees: data.semaines_freeze_consommees,
                          })
                        }
                      }}
                      style={{
                        marginLeft: 8, fontSize: 11, padding: '1px 7px',
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: 4, cursor: 'pointer', color: 'var(--muted)',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Paiements */}
          {detail && detail.echeances.length > 0 && (
            <Section title="Paiements">
              {(() => {
                const total = detail.echeances.reduce((s, e) => s + Number(e.montant), 0)
                const encaisse = detail.echeances.filter(e => e.encaisse).reduce((s, e) => s + Number(e.montant), 0)
                const resteAEncaisser = total - encaisse
                return (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>{encaisse.toFixed(2)} €</div>
                        <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>encaissé</div>
                      </div>
                      {resteAEncaisser > 0 && (
                        <div style={{ flex: 1, background: 'var(--border2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--dark)' }}>{resteAEncaisser.toFixed(2)} €</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>à venir</div>
                        </div>
                      )}
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      {detail.echeances.map((ec, i) => (
                        <div key={ec.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                          background: ec.encaisse ? 'var(--card)' : 'var(--border2)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              background: ec.encaisse ? '#16a34a' : 'var(--border)',
                              border: ec.encaisse ? 'none' : '1.5px solid #9ca3af',
                              display: 'inline-block',
                            }} />
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {ec.encaisse && ec.date_encaissement
                                ? fmt(ec.date_encaissement)
                                : fmt(ec.date_prelevement)}
                            </span>
                            {!ec.encaisse && (
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>prévu</span>
                            )}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: ec.encaisse ? 'var(--dark)' : 'var(--muted)' }}>
                            {Number(ec.montant).toFixed(2)} €
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </Section>
          )}

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
                onDeleted={deleteSeance}
              />
            ))}
          </Section>
        </div>
      </div>
    </>
  )
}

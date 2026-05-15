'use client'

import { useEffect, useState } from 'react'
import type { LeadRow } from './LeadsClient'
import { ContactActions } from '@/app/components/ContactActions'

type Formule = { id: string; label: string; duree_mois: number }

const STATUT_LABELS: Record<string, string> = {
  non_qualifie: 'Non qualifié',
  qualifie: '1. Qualifié',
  reserve: '2. Réservé',
  present: '3. Présent',
  eleve: '4. Élève',
  ancien_eleve: 'Ancien élève',
}

const ACTION_LABELS: Record<string, string> = {
  appel: 'Appel',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  mail: 'Mail',
  cours_essai: "Cours d'essai",
  cours_offert: 'Cours offert',
  temoignage: 'Témoignage',
}

const TRANCHE_LABELS: Record<string, string> = {
  moins_de_30: '< 30 ans',
  '30_45': '30–45 ans',
  '45_60': '45–60 ans',
  plus_de_60: '> 60 ans',
}

function fmt(iso: string | null, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (withTime) {
    return d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'long', year: 'numeric' })
}

// Extrait la date YYYY-MM-DD en heure Paris
function parisDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString('sv', { timeZone: 'Europe/Paris' })
}

// Extrait l'heure HH:MM en heure Paris
function parisTimeStr(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

type Action = { id: string; type: string; date: string; note: string | null }

function DeleteButton({ leadId, onDeleted }: { leadId: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
    onDeleted()
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="w-full py-2 rounded-xl text-xs font-medium"
        style={{ border: '1.5px solid #fecaca', color: '#dc2626' }}
      >
        Supprimer définitivement
      </button>
    )
  }

  return (
    <div className="flex gap-2 p-3 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
      <p className="text-xs flex-1" style={{ color: '#dc2626' }}>Supprimer définitivement ? Cette action est irréversible.</p>
      <button onClick={() => setConfirm(false)} className="text-xs px-2" style={{ color: 'var(--muted2)' }}>Annuler</button>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-xs px-3 py-1 rounded-lg font-semibold text-white"
        style={{ background: '#dc2626' }}
      >
        {loading ? '…' : 'Supprimer'}
      </button>
    </div>
  )
}

type Props = {
  lead: LeadRow
  onClose: () => void
  onLeadChanged: (changes: Partial<LeadRow>) => void
  onArchived: () => void
  onActionAdded: (action: Action) => void
  onDeleted?: () => void
}

export default function LeadPanel({ lead, onClose, onLeadChanged, onArchived, onActionAdded, onDeleted }: Props) {
  const [currentLead, setCurrentLead] = useState<LeadRow>(lead)
  const [saving, setSaving] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [archiveRaison, setArchiveRaison] = useState('non_qualifie')
  const [showActionForm, setShowActionForm] = useState(false)
  const [actionForm, setActionForm] = useState({ type: 'appel', date: todayIso(), note: '' })
  const [showProchaineForm, setShowProchaineForm] = useState(false)
  const initHeure = (() => {
    if (!currentLead.prochaine_action_date) return ''
    const t = parisTimeStr(currentLead.prochaine_action_date)
    return t !== '00:00' ? t : ''
  })()
  const [prochaineForm, setProchaineForm] = useState({
    type: currentLead.prochaine_action_type ?? 'appel',
    date: currentLead.prochaine_action_date ? parisDateStr(currentLead.prochaine_action_date) : '',
    heure: initHeure,
    note: currentLead.prochaine_action_note ?? '',
  })
  const [showHeure, setShowHeure] = useState(!!initHeure)
  const [error, setError] = useState<string | null>(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [formules, setFormules] = useState<Formule[]>([])

  useEffect(() => {
    fetch('/api/formules').then(r => r.json()).then(setFormules)
  }, [])
  const [convertForm, setConvertForm] = useState({
    formule: 'programme_4_mois',
    date_debut: new Date().toISOString().slice(0, 10),
    mode_paiement: 'cb_2x',
    objectifs: lead.objectifs ?? '',
  })

  function todayIso() {
    return new Date().toISOString().slice(0, 10)
  }

  function update(changes: Partial<LeadRow>) {
    setCurrentLead(prev => ({ ...prev, ...changes }))
    onLeadChanged(changes)
  }

  async function handleStatutChange(statut: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${currentLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      if (!res.ok) throw new Error()
      update({ statut })
    } catch {
      setError('Erreur lors de la mise à jour du statut')
    } finally {
      setSaving(false)
    }
  }

  async function handleCoursEssaiChange(field: 'cours_essai_date' | 'cours_essai_fait', value: string | boolean) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${currentLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error()
      update({ [field]: value } as Partial<LeadRow>)
    } catch {
      setError('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveProchaine() {
    setSaving(true)
    setError(null)
    try {
      const body = prochaineForm.date
        ? {
            prochaine_action_type: prochaineForm.type,
            prochaine_action_date: new Date(`${prochaineForm.date}T${prochaineForm.heure || '00:00'}`).toISOString(),
            prochaine_action_note: prochaineForm.note || null,
          }
        : {
            prochaine_action_type: null,
            prochaine_action_date: null,
            prochaine_action_note: null,
          }
      const res = await fetch(`/api/leads/${currentLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      update(body as Partial<LeadRow>)
      setShowProchaineForm(false)
    } catch {
      setError('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${currentLead.id}/archiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raison: archiveRaison }),
      })
      if (!res.ok) throw new Error()
      onArchived()
    } catch {
      setError('Erreur lors de l\'archivage')
      setSaving(false)
    }
  }

  async function handleConvertirEleve(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/eleves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: currentLead.id, ...convertForm }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur')
      }
      setShowConvertModal(false)
      onArchived()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la conversion')
      setSaving(false)
    }
  }

  async function handleAddAction(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${currentLead.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionForm),
      })
      if (!res.ok) throw new Error()
      const action: Action = await res.json()

      const updatedJournal = [action, ...currentLead.journal]
      setCurrentLead(prev => ({
        ...prev,
        journal: updatedJournal,
        dernier_contact_date: action.date,
      }))
      onActionAdded(action)
      setActionForm({ type: 'appel', date: todayIso(), note: '' })
      setShowActionForm(false)
    } catch {
      setError('Erreur lors de l\'ajout de l\'action')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAction(actionId: string) {
    try {
      await fetch(`/api/leads/${currentLead.id}/actions/${actionId}`, { method: 'DELETE' })
      const updatedJournal = currentLead.journal.filter(a => a.id !== actionId)
      setCurrentLead(prev => ({ ...prev, journal: updatedJournal }))
      onLeadChanged({ journal: updatedJournal })
    } catch {
      setError('Erreur lors de la suppression')
    }
  }

  const inputStyle = {
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    padding: '6px 10px',
    background: 'white',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  }

  const sectionTitle = (label: string) => (
    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)' }}>
      {label}
    </p>
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="panel-slide fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          background: 'var(--card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-start justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-base font-bold truncate" style={{ color: 'var(--dark)' }}>
              {currentLead.nom}
            </h2>
            <ContactActions
              email={currentLead.email}
              telephone={currentLead.telephone ?? undefined}
              style={{ marginTop: 2 }}
            />
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ border: '1.5px solid var(--border)', color: 'var(--muted2)' }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {error && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* Statut + Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              {sectionTitle('Statut')}
              <select
                value={currentLead.statut}
                onChange={e => handleStatutChange(e.target.value)}
                disabled={saving}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="non_qualifie">Non qualifié</option>
                <option value="qualifie">1. Qualifié</option>
                <option value="reserve">2. Réservé</option>
                <option value="present">3. Présent</option>
                <option value="eleve">4. Élève</option>
              </select>
            </div>
            <div>
              {sectionTitle('Source')}
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {currentLead.source === 'pub_meta' ? 'Meta Ads' : 'Organique'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Entrée le {fmt(currentLead.created_at)}
              </p>
            </div>
          </div>

          {/* Cours d'essai (si statut reserve ou present) */}
          {(currentLead.statut === 'reserve' || currentLead.statut === 'present') && (
            <div>
              {sectionTitle("Cours d'essai")}
              <div className="space-y-2">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted2)' }}>Date et heure</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={currentLead.cours_essai_date ? parisDateStr(currentLead.cours_essai_date) : ''}
                      onChange={e => {
                        const time = currentLead.cours_essai_date ? parisTimeStr(currentLead.cours_essai_date) : '09:00'
                        handleCoursEssaiChange('cours_essai_date', e.target.value ? new Date(`${e.target.value}T${time}:00`).toISOString() : null as unknown as string)
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <select
                      value={currentLead.cours_essai_date ? parisTimeStr(currentLead.cours_essai_date) : ''}
                      onChange={e => {
                        const date = currentLead.cours_essai_date ? parisDateStr(currentLead.cours_essai_date) : new Date().toLocaleDateString('sv', { timeZone: 'Europe/Paris' })
                        handleCoursEssaiChange('cours_essai_date', new Date(`${date}T${e.target.value}:00`).toISOString())
                      }}
                      style={{ ...inputStyle, width: 100, flex: 'none' }}
                    >
                      <option value="">--:--</option>
                      {Array.from({ length: 17 * 4 }, (_, i) => {
                        const totalMin = 6 * 60 + i * 15
                        const h = String(Math.floor(totalMin / 60)).padStart(2, '0')
                        const m = String(totalMin % 60).padStart(2, '0')
                        return `${h}:${m}`
                      }).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentLead.cours_essai_fait}
                    onChange={e => handleCoursEssaiChange('cours_essai_fait', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm" style={{ color: 'var(--text)' }}>Cours d'essai réalisé</span>
                </label>
              </div>
            </div>
          )}

          {/* Prochaine action */}
          <div>
            {sectionTitle('Prochaine action')}
            {!showProchaineForm ? (
              <div className="flex items-center justify-between">
                {currentLead.prochaine_action_type ? (
                  <div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                      {ACTION_LABELS[currentLead.prochaine_action_type]}
                    </span>
                    <span className="text-sm ml-2" style={{ color: 'var(--muted2)' }}>
                      le {fmt(currentLead.prochaine_action_date)}
                      {currentLead.prochaine_action_date && (() => {
                        const t = parisTimeStr(currentLead.prochaine_action_date)
                        return t !== '00:00' ? <span className="ml-1" style={{ color: 'var(--muted)' }}>à {t}</span> : null
                      })()}
                    </span>
                    {currentLead.prochaine_action_note && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {currentLead.prochaine_action_note}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>Non planifiée</span>
                )}
                <div className="flex gap-2">
                  {currentLead.prochaine_action_type && (
                    <button
                      onClick={async () => {
                        setSaving(true)
                        setError(null)
                        try {
                          const body = { prochaine_action_type: null, prochaine_action_date: null, prochaine_action_note: null }
                          const res = await fetch(`/api/leads/${currentLead.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                          })
                          if (!res.ok) throw new Error()
                          update(body as Partial<LeadRow>)
                        } catch {
                          setError('Erreur lors de la suppression')
                        } finally {
                          setSaving(false)
                        }
                      }}
                      disabled={saving}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                      style={{ border: '1.5px solid var(--border)', color: 'var(--danger, #e53e3e)' }}
                    >
                      Supprimer
                    </button>
                  )}
                  <button
                    onClick={() => setShowProchaineForm(true)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                    style={{ border: '1.5px solid var(--border)', color: 'var(--muted2)' }}
                  >
                    {currentLead.prochaine_action_type ? 'Modifier' : 'Planifier'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-3 rounded-xl" style={{ background: 'var(--bg)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={prochaineForm.type}
                    onChange={e => setProchaineForm(p => ({ ...p, type: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="appel">Appel</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="mail">Mail</option>
                    <option value="cours_essai">Cours d'essai</option>
                    <option value="cours_offert">Cours offert</option>
                    <option value="temoignage">Témoignage</option>
                  </select>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={prochaineForm.date}
                      onChange={e => setProchaineForm(p => ({ ...p, date: e.target.value }))}
                      style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                    />
                    {showHeure ? (
                      <div className="flex gap-1 items-center">
                        <select
                          value={prochaineForm.heure.split(':')[0] ?? '09'}
                          onChange={e => setProchaineForm(p => ({ ...p, heure: `${e.target.value}:${p.heure.split(':')[1] ?? '00'}` }))}
                          style={{ ...inputStyle, width: '3.5rem' }}
                          autoFocus
                        >
                          {Array.from({ length: 17 }, (_, i) => i + 6).map(h => (
                            <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>
                          ))}
                        </select>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>:</span>
                        <select
                          value={prochaineForm.heure.split(':')[1] ?? '00'}
                          onChange={e => setProchaineForm(p => ({ ...p, heure: `${p.heure.split(':')[0] ?? '09'}:${e.target.value}` }))}
                          style={{ ...inputStyle, width: '3.5rem' }}
                        >
                          {['00', '15', '30', '45'].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => { setProchaineForm(p => ({ ...p, heure: '' })); setShowHeure(false) }}
                          className="text-xs"
                          style={{ color: 'var(--muted)', lineHeight: 1 }}
                          title="Retirer l'heure"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowHeure(true)}
                        className="text-xs px-2 rounded-lg"
                        style={{ border: '1.5px dashed var(--border)', color: 'var(--muted)', whiteSpace: 'nowrap' }}
                      >
                        + heure
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Note (optionnel)"
                  value={prochaineForm.note}
                  onChange={e => setProchaineForm(p => ({ ...p, note: e.target.value }))}
                  style={inputStyle}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowProchaineForm(false); setShowHeure(!!initHeure) }}
                    className="flex-1 py-1.5 text-xs rounded-lg font-medium"
                    style={{ border: '1.5px solid var(--border)', color: 'var(--muted2)' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveProchaine}
                    disabled={saving}
                    className="flex-1 py-1.5 text-xs rounded-lg font-medium text-white"
                    style={{ background: 'var(--dark)' }}
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Questionnaire */}
          <div>
            {sectionTitle('Questionnaire')}
            {!currentLead.questionnaire && !currentLead.objectifs && !currentLead.problemes ? (
              <span className="text-sm" style={{ color: 'var(--muted)' }}>Questionnaire non renseigné</span>
            ) : (() => {
              const q = currentLead.questionnaire
              // Parse disqualifying values from "Label : Value | Label2 : Value2"
              const disqualValues = new Set(
                (q?.disqualification_raison ?? '')
                  .split(' | ')
                  .map(r => r.split(' : ').slice(1).join(' : ').trim())
                  .filter(Boolean)
              )
              const field = (label: string, value: string | null | undefined) => {
                if (!value) return null
                const bad = disqualValues.has(value)
                return (
                  <div key={label}>
                    <span className="block mb-0.5 text-xs" style={{ color: 'var(--muted2)' }}>{label}</span>
                    <p style={{ color: bad ? '#dc2626' : 'var(--text)', fontWeight: bad ? 600 : 'normal', lineHeight: 1.5 }}>
                      {bad && '✕ '}{value}
                    </p>
                  </div>
                )
              }
              return (
                <div className="space-y-3 text-sm">
                  {field('Ancienneté guitare', q?.anciennete)}
                  {field('Objectifs', currentLead.objectifs)}
                  {field('Blocages', currentLead.problemes)}
                  {field('Essais passés', q?.essais_passes)}
                  {field('Programme Guitarisation', q?.adhesion_programme)}
                  {field("Attentes cours d'essai", q?.attentes_cours)}
                  {field('Délai démarrage', q?.delai_demarrage)}
                </div>
              )
            })()}
          </div>

          {/* Journal */}
          <div>
            {sectionTitle('Journal de contact')}
            <div className="space-y-2 mb-3">
              {currentLead.journal.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Aucune action enregistrée</p>
              ) : (
                currentLead.journal.map(action => (
                  <div
                    key={action.id}
                    className="flex gap-3 py-2 px-3 rounded-lg"
                    style={{ background: 'var(--bg)' }}
                  >
                    <div className="shrink-0">
                      <span
                        className="inline-block text-[11px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: action.type === 'cours_essai' ? 'var(--accent-soft)' : 'var(--border)',
                          color: action.type === 'cours_essai' ? 'var(--accent)' : 'var(--muted2)',
                        }}
                      >
                        {ACTION_LABELS[action.type] ?? action.type}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: 'var(--muted2)' }}>
                        {fmt(action.date)}
                      </p>
                      {action.note && (
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text)', lineHeight: 1.4 }}>
                          {action.note}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAction(action.id)}
                      className="shrink-0 text-xs opacity-40 hover:opacity-100 transition-opacity"
                      style={{ color: '#dc2626' }}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Formulaire ajout action */}
            {!showActionForm ? (
              <button
                onClick={() => setShowActionForm(true)}
                className="w-full py-2 text-sm font-medium rounded-xl"
                style={{ border: '1.5px dashed var(--border)', color: 'var(--muted2)' }}
              >
                + Ajouter une action
              </button>
            ) : (
              <form onSubmit={handleAddAction} className="space-y-2 p-3 rounded-xl" style={{ background: 'var(--bg)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={actionForm.type}
                    onChange={e => setActionForm(p => ({ ...p, type: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="appel">Appel</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="mail">Mail</option>
                    <option value="cours_essai">Cours d'essai</option>
                  </select>
                  <input
                    type="date"
                    value={actionForm.date.slice(0, 10)}
                    onChange={e => setActionForm(p => ({ ...p, date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <textarea
                  placeholder="Note (optionnel)"
                  value={actionForm.note}
                  onChange={e => setActionForm(p => ({ ...p, note: e.target.value }))}
                  rows={2}
                  style={{ ...inputStyle, resize: 'none' }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowActionForm(false)}
                    className="flex-1 py-1.5 text-xs rounded-lg font-medium"
                    style={{ border: '1.5px solid var(--border)', color: 'var(--muted2)' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-1.5 text-xs rounded-lg font-medium text-white"
                    style={{ background: 'var(--dark)' }}
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>

          {/* Convertir en élève (tous statuts actifs) */}
          {['non_qualifie', 'qualifie', 'reserve', 'present'].includes(currentLead.statut) && (
            <button
              onClick={() => setShowConvertModal(true)}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Convertir en élève
            </button>
          )}

          {/* Supprimer définitivement (leads archivés uniquement) */}
          {currentLead.archive && onDeleted && (
            <DeleteButton leadId={currentLead.id} onDeleted={onDeleted} />
          )}

          {/* Archiver (uniquement si le lead n'est pas déjà archivé) */}
          {!currentLead.archive && (!showArchiveConfirm ? (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="w-full py-2 rounded-xl text-sm font-medium"
              style={{ border: '1.5px solid var(--border)', color: 'var(--muted2)' }}
            >
              Archiver ce lead
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl" style={{ background: 'var(--bg)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--dark)' }}>Raison de l'archivage</p>
              <select
                value={archiveRaison}
                onChange={e => setArchiveRaison(e.target.value)}
                style={inputStyle}
              >
                <option value="non_qualifie">Non qualifié</option>
                <option value="sans_reponse">Sans réponse</option>
                <option value="abandon">Abandon</option>
                <option value="budget">Budget</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 py-1.5 text-xs rounded-lg font-medium"
                  style={{ border: '1.5px solid var(--border)', color: 'var(--muted2)' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleArchive}
                  disabled={saving}
                  className="flex-1 py-1.5 text-xs rounded-lg font-medium text-white"
                  style={{ background: '#dc2626' }}
                >
                  Confirmer l'archivage
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Modal conversion en élève */}
      {showConvertModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)',
        }}>
          <div style={{
            background: 'var(--card)', borderRadius: 12, padding: 28, width: 420,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: 'var(--dark)' }}>
              Convertir en élève
            </h3>
            <form onSubmit={handleConvertirEleve} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted2)', display: 'block', marginBottom: 4 }}>Formule</label>
                <select
                  value={convertForm.formule}
                  onChange={e => setConvertForm(p => ({ ...p, formule: e.target.value }))}
                  style={inputStyle}
                  required
                >
                  {formules.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted2)', display: 'block', marginBottom: 4 }}>Date de début</label>
                <input
                  type="date"
                  value={convertForm.date_debut}
                  onChange={e => setConvertForm(p => ({ ...p, date_debut: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted2)', display: 'block', marginBottom: 4 }}>Mode de paiement</label>
                <select
                  value={convertForm.mode_paiement}
                  onChange={e => setConvertForm(p => ({ ...p, mode_paiement: e.target.value }))}
                  style={inputStyle}
                  required
                >
                  <option value="cb_1x">CB 1×</option>
                  <option value="cb_2x">CB 2×</option>
                  <option value="cb_3x">CB 3×</option>
                  <option value="cb_4x">CB 4×</option>
                  <option value="paypal_4x">PayPal 4×</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted2)', display: 'block', marginBottom: 4 }}>Objectifs</label>
                <textarea
                  value={convertForm.objectifs}
                  onChange={e => setConvertForm(p => ({ ...p, objectifs: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Objectifs de l'élève..."
                />
              </div>
              {error && (
                <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setShowConvertModal(false); setError(null) }}
                  style={{
                    flex: 1, padding: '9px 0', border: '1.5px solid var(--border)', borderRadius: 8,
                    background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--muted2)', fontWeight: 500,
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1, padding: '9px 0', background: 'var(--accent)', border: 'none', borderRadius: 8,
                    cursor: 'pointer', fontSize: 13, color: 'white', fontWeight: 600,
                  }}
                >
                  {saving ? 'Création...' : 'Créer l\'élève'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

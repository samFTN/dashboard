'use client'

import { useState } from 'react'
import type { LeadRow } from './LeadsClient'

const STATUT_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  qualifie: 'Qualifié',
  reserve: 'Réservé',
  present: 'Présent',
  eleve: 'Élève',
  ancien_eleve: 'Ancien élève',
}

const ACTION_LABELS: Record<string, string> = {
  appel: 'Appel',
  sms: 'SMS',
  cours_essai: "Cours d'essai",
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
    return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

type Action = { id: string; type: string; date: string; note: string | null }

type Props = {
  lead: LeadRow
  onClose: () => void
  onLeadChanged: (changes: Partial<LeadRow>) => void
  onArchived: () => void
  onActionAdded: (action: Action) => void
}

export default function LeadPanel({ lead, onClose, onLeadChanged, onArchived, onActionAdded }: Props) {
  const [currentLead, setCurrentLead] = useState<LeadRow>(lead)
  const [saving, setSaving] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [archiveRaison, setArchiveRaison] = useState('non_qualifie')
  const [showActionForm, setShowActionForm] = useState(false)
  const [actionForm, setActionForm] = useState({ type: 'appel', date: todayIso(), note: '' })
  const [showProchaineForm, setShowProchaineForm] = useState(false)
  const [prochaineForm, setProchaineForm] = useState({
    type: currentLead.prochaine_action_type ?? 'appel',
    date: currentLead.prochaine_action_date?.slice(0, 10) ?? '',
    note: currentLead.prochaine_action_note ?? '',
  })
  const [error, setError] = useState<string | null>(null)

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
            prochaine_action_date: prochaineForm.date,
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

  async function handleConvertirEleve() {
    if (!confirm('Convertir ce lead en élève ? La fiche lead sera archivée. (La fiche élève sera créée à l\'étape 4.)')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${currentLead.id}/archiver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raison: 'abandon' }), // placeholder — sera refactoré à l'étape 4
      })
      if (!res.ok) throw new Error()

      // Also update statut to 'eleve'
      await fetch(`/api/leads/${currentLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'eleve' }),
      })
      onArchived()
    } catch {
      setError('Erreur lors de la conversion')
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
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: 420,
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
            <p className="text-sm truncate mt-0.5" style={{ color: 'var(--muted2)' }}>
              {currentLead.email}
            </p>
            {currentLead.telephone && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted2)' }}>
                {currentLead.telephone}
              </p>
            )}
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
                <option value="nouveau">Nouveau</option>
                <option value="qualifie">Qualifié</option>
                <option value="reserve">Réservé</option>
                <option value="present">Présent</option>
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
                  <input
                    type="datetime-local"
                    value={currentLead.cours_essai_date?.slice(0, 16) ?? ''}
                    onChange={e => handleCoursEssaiChange('cours_essai_date', e.target.value || null as unknown as string)}
                    style={inputStyle}
                  />
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
                <button
                  onClick={() => setShowProchaineForm(true)}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                  style={{ border: '1.5px solid var(--border)', color: 'var(--muted2)' }}
                >
                  {currentLead.prochaine_action_type ? 'Modifier' : 'Planifier'}
                </button>
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
                    <option value="cours_essai">Cours d'essai</option>
                  </select>
                  <input
                    type="date"
                    value={prochaineForm.date}
                    onChange={e => setProchaineForm(p => ({ ...p, date: e.target.value }))}
                    style={inputStyle}
                  />
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
                    onClick={() => setShowProchaineForm(false)}
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
            <div className="space-y-2 text-sm">
              {currentLead.tranche_age && (
                <div className="flex gap-2">
                  <span style={{ color: 'var(--muted2)' }}>Âge :</span>
                  <span style={{ color: 'var(--text)' }}>{TRANCHE_LABELS[currentLead.tranche_age] ?? currentLead.tranche_age}</span>
                </div>
              )}
              {currentLead.objectifs && (
                <div>
                  <span className="block mb-0.5" style={{ color: 'var(--muted2)' }}>Objectifs :</span>
                  <p style={{ color: 'var(--text)', lineHeight: 1.5 }}>{currentLead.objectifs}</p>
                </div>
              )}
              {currentLead.problemes && (
                <div>
                  <span className="block mb-0.5" style={{ color: 'var(--muted2)' }}>Blocages :</span>
                  <p style={{ color: 'var(--text)', lineHeight: 1.5 }}>{currentLead.problemes}</p>
                </div>
              )}
              {!currentLead.tranche_age && !currentLead.objectifs && !currentLead.problemes && (
                <span style={{ color: 'var(--muted)' }}>Questionnaire non renseigné</span>
              )}
            </div>
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
                        {fmt(action.date, true)}
                      </p>
                      {action.note && (
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text)', lineHeight: 1.4 }}>
                          {action.note}
                        </p>
                      )}
                    </div>
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
                    <option value="cours_essai">Cours d'essai</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={actionForm.date + 'T00:00'}
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

          {/* Convertir en élève (uniquement si statut = present) */}
          {currentLead.statut === 'present' && (
            <button
              onClick={handleConvertirEleve}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Convertir en élève
            </button>
          )}

          {/* Archiver */}
          {!showArchiveConfirm ? (
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
          )}
        </div>
      </div>
    </>
  )
}

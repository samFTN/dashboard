'use client'

import { useState, useCallback } from 'react'
import LeadPanel from './LeadPanel'

export type LeadRow = {
  id: string
  nom: string
  email: string
  telephone: string | null
  statut: string
  source: string
  archive: boolean
  raison_archivage: string | null
  date_archivage: string | null
  cours_essai_date: string | null
  cours_essai_fait: boolean
  prochaine_action_type: string | null
  prochaine_action_date: string | null
  prochaine_action_note: string | null
  tranche_age: string | null
  objectifs: string | null
  problemes: string | null
  questionnaire: {
    anciennete?: string
    essais_passes?: string
    adhesion_programme?: string
    attentes_cours?: string
    delai_demarrage?: string
    disqualification_raison?: string
  } | null
  eleve_id: string | null
  created_at: string
  updated_at: string
  dernier_contact_date: string | null
  journal: Array<{ id: string; type: string; date: string; note: string | null }>
}

const STATUT_LABELS: Record<string, string> = {
  non_qualifie:  'Non qualifié',
  qualifie:      '1. Qualifié',
  reserve:       '2. Réservé',
  present:       '3. Présent',
  eleve:         '4. Élève',
  ancien_eleve:  'Ancien élève',
}

const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  non_qualifie: { bg: '#fef2f2', color: '#dc2626' },
  qualifie:     { bg: '#eff6ff', color: '#1d4ed8' },
  reserve:      { bg: '#fef9e3', color: '#a16207' },
  present:      { bg: '#f0fdf4', color: '#15803d' },
  eleve:        { bg: '#fef9e3', color: '#d4a017' },
  ancien_eleve: { bg: '#faf5ff', color: '#7c3aed' },
}

const PIPELINE_STATUTS = ['non_qualifie', 'qualifie', 'reserve', 'present']

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const contactDay = new Date(iso); contactDay.setHours(0, 0, 0, 0)
  const d = Math.round((today.getTime() - contactDay.getTime()) / 86_400_000)
  if (d < 0) return '—'
  if (d === 0) return "auj."
  if (d === 1) return '1j'
  if (d < 7) return `${d}j`
  if (d < 30) return `${Math.floor(d / 7)} sem.`
  return fmt(iso)
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

function CreateLeadModal({
  existingLeads,
  onClose,
  onCreated,
}: {
  existingLeads: LeadRow[]
  onClose: () => void
  onCreated: (lead: LeadRow) => void
}) {
  const [form, setForm] = useState({
    nom: '', email: '', telephone: '', source: 'pub_meta',
    tranche_age: '', objectifs: '', problemes: '',
  })
  const [dupWarning, setDupWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    width: '100%',
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    padding: '7px 10px',
    background: 'white',
    fontSize: 13,
    outline: 'none',
  }

  function checkDup(email: string, tel: string) {
    const dup = existingLeads.find(l =>
      (email && l.email === email.toLowerCase()) ||
      (tel && l.telephone === tel)
    )
    setDupWarning(dup ? `Doublon possible : ${dup.nom} (${dup.email})` : null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.status === 409) {
        setError(`Doublon : ${(data.doublons as { nom: string }[]).map(d => d.nom).join(', ')}`)
        return
      }
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      onCreated(data)
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-6 space-y-4 overflow-y-auto"
        style={{ background: 'var(--card)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: 'var(--dark)' }}>Nouveau lead</h2>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted2)' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { label: 'Nom *', key: 'nom', type: 'text', placeholder: 'Prénom Nom', required: true },
            { label: 'Email *', key: 'email', type: 'email', placeholder: 'email@exemple.fr', required: true },
            { label: 'Téléphone', key: 'telephone', type: 'text', placeholder: '06 XX XX XX XX', required: false },
          ].map(({ label, key, type, placeholder, required }) => (
            <div key={key}>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--muted2)' }}>{label}</label>
              <input
                type={type}
                required={required}
                placeholder={placeholder}
                style={inputStyle}
                value={form[key as keyof typeof form]}
                onChange={e => {
                  setForm(p => ({ ...p, [key]: e.target.value }))
                  if (key === 'email') checkDup(e.target.value, form.telephone)
                  if (key === 'telephone') checkDup(form.email, e.target.value)
                }}
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--muted2)' }}>Source *</label>
            <select required style={inputStyle} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
              <option value="pub_meta">Meta Ads</option>
              <option value="organique">Organique</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--muted2)' }}>Tranche d'âge</label>
            <select style={inputStyle} value={form.tranche_age} onChange={e => setForm(p => ({ ...p, tranche_age: e.target.value }))}>
              <option value="">— Non renseigné</option>
              <option value="moins_de_30">Moins de 30 ans</option>
              <option value="30_45">30–45 ans</option>
              <option value="45_60">45–60 ans</option>
              <option value="plus_de_60">Plus de 60 ans</option>
            </select>
          </div>

          {(['objectifs', 'problemes'] as const).map(key => (
            <div key={key}>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--muted2)' }}>
                {key === 'objectifs' ? 'Objectifs' : 'Blocages / problèmes'}
              </label>
              <textarea
                rows={2}
                style={{ ...inputStyle, resize: 'none' }}
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={key === 'objectifs' ? 'Ex : jouer des chansons folk...' : 'Ex : débutant complet...'}
              />
            </div>
          ))}

          {dupWarning && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef9e3', color: '#a16207' }}>
              Doublon possible : {dupWarning}
            </p>
          )}
          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-semibold"
              style={{ border: '1.5px solid var(--border)', color: 'var(--muted2)' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: loading ? 'var(--muted)' : 'var(--dark)' }}>
              {loading ? 'Création...' : 'Créer le lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeadsClient({ initialLeads, todayCount }: { initialLeads: LeadRow[]; todayCount: number }) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads)
  const [showArchived, setShowArchived] = useState(false)
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const fetchLeads = useCallback(async (archived: boolean, statut: string, source: string) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ archive: String(archived) })
      if (statut) p.set('statut', statut)
      if (source) p.set('source', source)
      const res = await fetch(`/api/leads?${p}`)
      if (res.ok) {
        const data: LeadRow[] = await res.json()
        setLeads(data)
        // Sync selected lead if still present
        setSelectedLead(prev => prev ? (data.find(l => l.id === prev.id) ?? null) : null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  function handleTabChange(archived: boolean) {
    setShowArchived(archived)
    setFilterStatut('')
    setFilterSource('')
    fetchLeads(archived, '', '')
  }

  function handleStatutFilter(s: string) {
    setFilterStatut(s)
    fetchLeads(showArchived, s, filterSource)
  }

  function handleSourceFilter(s: string) {
    setFilterSource(s)
    fetchLeads(showArchived, filterStatut, s)
  }

  function handleLeadChanged(changes: Partial<LeadRow>) {
    setLeads(prev => prev.map(l => l.id === selectedLead?.id ? { ...l, ...changes } : l))
    setSelectedLead(prev => prev ? { ...prev, ...changes } : null)
  }

  function handleLeadArchived() {
    setLeads(prev => prev.filter(l => l.id !== selectedLead?.id))
    setSelectedLead(null)
  }

  function handleActionAdded(action: LeadRow['journal'][0]) {
    const changes: Partial<LeadRow> = {
      journal: [action, ...(selectedLead?.journal ?? [])],
      dernier_contact_date: action.date <= new Date().toISOString().slice(0, 10) ? action.date : selectedLead?.dernier_contact_date ?? null,
    }
    handleLeadChanged(changes)
  }

  const selectStyle = {
    border: '1.5px solid var(--border)',
    borderRadius: 10,
    padding: '6px 12px',
    background: 'white',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
  }

  const today = new Date().toISOString().slice(0, 10)
  const [filterAujourdhui, setFilterAujourdhui] = useState(false)
  const actionItems = !showArchived ? (() => {
    const aRelancer = leads.filter(l =>
      l.prochaine_action_date && l.prochaine_action_date.slice(0, 10) < today
    ).length
    const coursAujourdhui = leads.filter(l =>
      l.prochaine_action_type === 'cours_essai' &&
      l.prochaine_action_date?.slice(0, 10) === today
    ).length
    const sansPlan = leads.filter(l =>
      !l.prochaine_action_date &&
      !(l.statut === 'reserve' && l.cours_essai_date) &&
      ['qualifie', 'reserve', 'present'].includes(l.statut)
    ).length
    const aFaireAujourdhui = leads.filter(l =>
      l.prochaine_action_date?.slice(0, 10) === today
    ).length
    return { aRelancer, coursAujourdhui, sansPlan, aFaireAujourdhui }
  })() : null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-8 pt-6 md:pt-8 pb-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--dark)', letterSpacing: '-0.5px' }}>
              Leads
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm" style={{ color: 'var(--muted2)' }}>
                {`${leads.length} lead${leads.length > 1 ? 's' : ''} ${showArchived ? 'archivé' : 'actif'}${leads.length > 1 ? 's' : ''}`}
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
          {!showArchived && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--dark)' }}
            >
              + Nouveau lead
            </button>
          )}
        </div>

        {/* Tabs + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1.5px solid var(--border)' }}>
            {[{ label: 'Actifs', archived: false }, { label: 'Archivés', archived: true }].map(({ label, archived }) => (
              <button
                key={label}
                onClick={() => handleTabChange(archived)}
                className="px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: showArchived === archived ? 'var(--dark)' : 'transparent',
                  color: showArchived === archived ? 'white' : 'var(--muted2)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <select value={filterStatut} onChange={e => handleStatutFilter(e.target.value)} style={selectStyle}>
            <option value="">Tous les statuts</option>
            {PIPELINE_STATUTS.map(s => (
              <option key={s} value={s}>{STATUT_LABELS[s]}</option>
            ))}
          </select>

          <select value={filterSource} onChange={e => handleSourceFilter(e.target.value)} style={selectStyle}>
            <option value="">Toutes les sources</option>
            <option value="pub_meta">Meta Ads</option>
            <option value="organique">Organique</option>
          </select>

          {loading && <span className="text-xs" style={{ color: 'var(--muted)' }}>Chargement…</span>}
        </div>
      </div>

      {/* Bandeau actions */}
      {actionItems && (actionItems.aRelancer > 0 || actionItems.coursAujourdhui > 0 || actionItems.sansPlan > 0 || actionItems.aFaireAujourdhui > 0) && (
        <div className="px-4 md:px-8 pt-3">
          <div className="flex items-center gap-2 flex-wrap rounded-xl px-4 py-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>À faire</span>
            {actionItems.aFaireAujourdhui > 0 && (
              <button
                onClick={() => setFilterAujourdhui(f => !f)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-opacity hover:opacity-75"
                style={filterAujourdhui
                  ? { background: 'var(--accent)', color: 'white', border: '1px solid var(--accent)' }
                  : { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
              >
                {`✓ ${actionItems.aFaireAujourdhui} aujourd'hui`}
              </button>
            )}
            {actionItems.aRelancer > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                ⏰ {actionItems.aRelancer} à relancer
              </span>
            )}
            {actionItems.coursAujourdhui > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                {`🎸 ${actionItems.coursAujourdhui} cours d'essai aujourd'hui`}
              </span>
            )}
            {actionItems.sansPlan > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}>
                📋 {actionItems.sansPlan} sans action planifiée
              </span>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-5">
        <div
          className="rounded-2xl overflow-hidden overflow-x-auto"
          style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <table className="w-full text-sm border-collapse" style={{ minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                {['Nom', 'Statut', 'Source', 'Entrée', 'Dernier contact'].map(col => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--muted2)' }}
                  >
                    {col}
                  </th>
                ))}
                <th
                  className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: 'var(--muted2)' }}
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                >
                  Prochaine action {sortDir === 'asc' ? '↑' : '↓'}
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
                    Aucun lead {showArchived ? 'archivé' : 'actif'}
                  </td>
                </tr>
              ) : (
                (() => {
                  const filtered = leads.filter(l => !filterAujourdhui || l.prochaine_action_date?.slice(0, 10) === today)
                  filtered.sort((a, b) => {
                    const da = a.prochaine_action_date ?? (a.statut === 'reserve' ? a.cours_essai_date : null)
                    const db = b.prochaine_action_date ?? (b.statut === 'reserve' ? b.cours_essai_date : null)
                    if (!da && !db) return 0
                    if (!da) return -1
                    if (!db) return 1
                    return sortDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da)
                  })
                  return filtered
                })().map((lead, i) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--border2)' : undefined,
                      background: selectedLead?.id === lead.id ? 'var(--accent-soft)' : undefined,
                    }}
                    onMouseEnter={e => {
                      if (selectedLead?.id !== lead.id)
                        (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)'
                    }}
                    onMouseLeave={e => {
                      if (selectedLead?.id !== lead.id)
                        (e.currentTarget as HTMLTableRowElement).style.background = ''
                    }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: 'var(--dark)' }}>{lead.nom}</p>
                      <p className="text-xs" style={{ color: 'var(--muted2)' }}>{lead.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge statut={lead.raison_archivage === 'non_qualifie' ? 'non_qualifie' : lead.statut} />
                      {lead.raison_archivage && lead.raison_archivage !== 'non_qualifie' && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          {lead.raison_archivage.replace(/_/g, ' ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted2)' }}>
                      {lead.source === 'pub_meta' ? 'Meta Ads' : 'Organique'}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted2)' }}>
                      {fmt(lead.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted2)' }}>
                      {timeAgo(lead.dernier_contact_date)}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const actionType = lead.prochaine_action_type
                          ?? (lead.statut === 'reserve' && lead.cours_essai_date ? 'cours_essai' : null)
                        const actionDate = lead.prochaine_action_date
                          ?? (lead.statut === 'reserve' ? lead.cours_essai_date : null)
                        return actionType ? (
                          <>
                            <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                              {({'appel': 'Appel', 'sms': 'SMS', 'whatsapp': 'WhatsApp', 'mail': 'Mail', 'cours_essai': "Cours d'essai", 'cours_offert': 'Cours offert', 'temoignage': 'Témoignage'} as Record<string,string>)[actionType] ?? actionType}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--muted2)' }}>
                              {fmt(actionDate)}
                              {actionDate && (() => {
                                const d = new Date(actionDate)
                                const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
                                return t !== '00:00' ? <span className="ml-1" style={{ color: 'var(--muted)' }}>à {t}</span> : null
                              })()}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                        )
                      })()}
                    </td>
                  </tr>
                ))
              )
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <LeadPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onLeadChanged={handleLeadChanged}
          onArchived={handleLeadArchived}
          onActionAdded={handleActionAdded}
          onDeleted={() => {
            setLeads(prev => prev.filter(l => l.id !== selectedLead.id))
            setSelectedLead(null)
          }}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateLeadModal
          existingLeads={leads}
          onClose={() => setShowCreate(false)}
          onCreated={(lead) => {
            setLeads(prev => [lead, ...prev])
            setShowCreate(false)
          }}
        />
      )}
    </div>
  )
}

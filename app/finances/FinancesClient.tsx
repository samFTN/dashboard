'use client'

import { useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────
type Echeance = {
  id: string; eleve_id: string; date_prelevement: string
  montant: number; encaisse: boolean; date_encaissement: string | null
  eleve_nom?: string
}

type Inscription = {
  id: string; eleve_id: string; date_inscription: string
  formule: string; mode_paiement: string; montant_contracte: number
  eleve_nom: string; eleve_email: string
  echeances: Echeance[]; montant_encaisse: number; reste_a_encaisser: number
}

type Outil = {
  id: string; nom: string; label: string
  montant_annuel: number; montant_mensuel: number
  date_renouvellement: string | null
}

type MetaCharge = {
  id?: string; mois: string; budget_journalier: number
  nb_jours: number; montant_realise: number | null
}

type Kpis = {
  revenus_contractes: number; revenus_encaisses: number; reste_a_encaisser: number
  charges_outils: number; charges_prof: number; charges_meta: number
  charges_total: number; ebitda: number; nb_seances_prof: number
}

type Periode = { debut: string; fin: string }

// ── Helpers ──────────────────────────────────────────────────
const EUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const EUR2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShort(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const MODE_LABELS: Record<string, string> = {
  cb_1x: 'CB 1×', cb_2x: 'CB 2×', cb_3x: 'CB 3×', cb_4x: 'CB 4×', paypal_4x: 'PayPal 4×',
}

// ── Composants ───────────────────────────────────────────────
function KpiCard({
  label, value, sub, color, highlight,
}: {
  label: string; value: string; sub?: string; color?: string; highlight?: boolean
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1"
      style={{
        background: highlight ? 'var(--dark)' : 'var(--card)',
        border: '1px solid var(--border)',
        minWidth: 0,
      }}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: highlight ? 'rgba(255,255,255,0.5)' : 'var(--muted)' }}>
        {label}
      </span>
      <span className="text-2xl font-black" style={{ color: color ?? (highlight ? 'white' : 'var(--dark)'), letterSpacing: '-0.5px' }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: highlight ? 'rgba(255,255,255,0.4)' : 'var(--muted)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────
export default function FinancesClient({
  kpis: initialKpis,
  outils: initialOutils,
  meta: initialMeta,
  inscriptions: initialInscriptions,
  echeances: initialEcheances,
  periode: initialPeriode,
  todayCount,
}: {
  kpis: Kpis
  outils: Outil[]
  meta: MetaCharge
  inscriptions: Inscription[]
  echeances: Echeance[]
  periode: Periode
  todayCount: number
}) {
  const [kpis, setKpis] = useState<Kpis>(initialKpis)
  const [outils, setOutils] = useState<Outil[]>(initialOutils)
  const [meta, setMeta] = useState<MetaCharge>(initialMeta)
  const [echeances, setEcheances] = useState<Echeance[]>(initialEcheances)
  const [periode, setPeriode] = useState<Periode>(initialPeriode)
  const [periodeType, setPeriodeType] = useState<'mois' | 'trimestre' | 'annee' | 'custom'>('mois')
  const [kpisLoading, setKpisLoading] = useState(false)
  const [outilEdit, setOutilEdit] = useState<string | null>(null)
  const [outilValues, setOutilValues] = useState<Record<string, string>>({})
  const [metaEdit, setMetaEdit] = useState(false)
  const [metaBudget, setMetaBudget] = useState(String(initialMeta.budget_journalier))

  // ── Période ────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)

  function computePeriode(type: 'mois' | 'trimestre' | 'annee' | 'custom', custom?: Periode): Periode {
    const now = new Date()
    if (type === 'mois') {
      const debut = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      return { debut, fin: today }
    }
    if (type === 'trimestre') {
      const q = Math.floor(now.getMonth() / 3)
      const debut = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`
      return { debut, fin: today }
    }
    if (type === 'annee') {
      return { debut: `${now.getFullYear()}-01-01`, fin: today }
    }
    return custom ?? periode
  }

  const fetchKpis = useCallback(async (p: Periode) => {
    setKpisLoading(true)
    try {
      const res = await fetch(`/api/finances/kpis?debut=${p.debut}&fin=${p.fin}`)
      if (res.ok) setKpis(await res.json())
    } finally {
      setKpisLoading(false)
    }
  }, [])

  function handlePeriodeType(type: 'mois' | 'trimestre' | 'annee' | 'custom') {
    setPeriodeType(type)
    if (type !== 'custom') {
      const p = computePeriode(type)
      setPeriode(p)
      fetchKpis(p)
    }
  }

  function handleCustomPeriode(field: 'debut' | 'fin', value: string) {
    const p = { ...periode, [field]: value }
    setPeriode(p)
    if (p.debut && p.fin && p.debut <= p.fin) fetchKpis(p)
  }

  // ── Encaisser une échéance ─────────────────────────────────
  async function encaisser(echeanceId: string) {
    const today2 = new Date().toISOString().slice(0, 10)
    await fetch(`/api/finances/echeances/${echeanceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encaisse: true, date_encaissement: today2 }),
    })
    setEcheances(prev =>
      prev.map(e => e.id === echeanceId ? { ...e, encaisse: true, date_encaissement: today2 } : e)
    )
    fetchKpis(periode)
  }

  // ── Modifier une charge outil ──────────────────────────────
  async function saveOutil(id: string) {
    const montant_annuel = parseFloat(outilValues[id])
    if (isNaN(montant_annuel)) return
    const res = await fetch(`/api/finances/charges/outils/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ montant_annuel }),
    })
    if (res.ok) {
      const updated = await res.json()
      setOutils(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o))
      fetchKpis(periode)
    }
    setOutilEdit(null)
  }

  // ── Modifier budget Meta ────────────────────────────────────
  async function saveMeta() {
    const budget_journalier = parseFloat(metaBudget)
    if (isNaN(budget_journalier)) return
    const res = await fetch('/api/finances/charges/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mois: meta.mois, budget_journalier }),
    })
    if (res.ok) {
      const updated = await res.json()
      setMeta(updated)
      fetchKpis(periode)
    }
    setMetaEdit(false)
  }

  // ── Tri échéances ──────────────────────────────────────────
  const echeancesAVenir = echeances.filter(e => !e.encaisse).sort(
    (a, b) => a.date_prelevement.localeCompare(b.date_prelevement)
  )
  const echeancesRecentes = echeances.filter(e => {
    if (!e.encaisse || !e.date_encaissement) return false
    const d = new Date(e.date_encaissement)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
    return d >= cutoff
  }).sort((a, b) => (b.date_encaissement ?? '').localeCompare(a.date_encaissement ?? ''))

  const totalOutilsMensuel = outils.reduce((acc, o) => acc + o.montant_annuel / 12, 0)
  const metaTotal = meta.montant_realise ?? meta.budget_journalier * meta.nb_jours

  return (
    <div className="h-full overflow-auto">
      <div className="px-4 md:px-8 pt-6 md:pt-8 pb-12 max-w-5xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--dark)', letterSpacing: '-0.5px' }}>
              Finances
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm" style={{ color: 'var(--muted2)' }}>
                SF PROD (EURL) · Guitarisation™
              </p>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={todayCount > 0
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                  : { background: 'var(--border)', color: 'var(--muted)' }}
              >
                {todayCount > 0 && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--accent)' }} />}
                {`${todayCount} paiement${todayCount > 1 ? 's' : ''} aujourd'hui`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Sélecteur de période ── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1.5px solid var(--border)' }}>
            {([
              { label: 'Ce mois', value: 'mois' as const },
              { label: 'Ce trimestre', value: 'trimestre' as const },
              { label: 'Cette année', value: 'annee' as const },
              { label: 'Personnalisé', value: 'custom' as const },
            ]).map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handlePeriodeType(value)}
                className="px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: periodeType === value ? 'var(--dark)' : 'transparent',
                  color: periodeType === value ? 'white' : 'var(--muted2)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {periodeType === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={periode.debut}
                onChange={e => handleCustomPeriode('debut', e.target.value)}
                className="text-sm px-3 py-1.5 rounded-xl"
                style={{ border: '1.5px solid var(--border)', background: 'var(--card)' }}
              />
              <span className="text-sm" style={{ color: 'var(--muted)' }}>→</span>
              <input type="date" value={periode.fin}
                onChange={e => handleCustomPeriode('fin', e.target.value)}
                className="text-sm px-3 py-1.5 rounded-xl"
                style={{ border: '1.5px solid var(--border)', background: 'var(--card)' }}
              />
            </div>
          )}
          {kpisLoading && <span className="text-xs" style={{ color: 'var(--muted)' }}>Calcul…</span>}
        </div>

        {/* ── KPI Cards ── */}
        <Section title={`Revenus · ${fmtShort(periode.debut)} – ${fmtShort(periode.fin)}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Contracté" value={EUR(kpis.revenus_contractes)} />
            <KpiCard label="Encaissé" value={EUR(kpis.revenus_encaisses)} color="#16a34a" />
            <KpiCard label="Reste à encaisser" value={EUR(kpis.reste_a_encaisser)}
              sub={`${echeancesAVenir.length} échéance${echeancesAVenir.length !== 1 ? 's' : ''}`}
            />
            <KpiCard
              label="EBITDA"
              value={EUR(kpis.ebitda)}
              highlight
              color={kpis.ebitda >= 0 ? '#4ade80' : '#f87171'}
              sub={`${EUR(kpis.charges_total)} de charges`}
            />
          </div>
        </Section>

        {/* ── Inscriptions (relevé par période) ── */}
        {(() => {
          const rows = initialInscriptions.filter(i =>
            i.date_inscription >= periode.debut && i.date_inscription <= periode.fin
          ).sort((a, b) => b.date_inscription.localeCompare(a.date_inscription))
          const totalContracte = rows.reduce((s, i) => s + Number(i.montant_contracte), 0)
          const totalEncaisse = rows.reduce((s, i) => s + Number(i.montant_encaisse), 0)
          return (
            <Section title={`Inscriptions · ${fmtShort(periode.debut)} – ${fmtShort(periode.fin)}`}>
              <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
                <table className="w-full text-sm border-collapse" style={{ minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Élève', 'Programme', 'Encaissé', 'Contracté'].map(col => (
                        <th key={col} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
                          Aucune inscription sur cette période
                        </td>
                      </tr>
                    ) : (
                      rows.map((insc, i) => (
                        <tr key={insc.id} style={{ borderTop: i > 0 ? '1px solid var(--border2)' : undefined }}>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted2)' }}>
                            {fmtShort(insc.date_inscription)}
                          </td>
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--dark)' }}>
                            {insc.eleve_nom}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted2)' }}>
                            {insc.formule === 'programme_4_mois' ? 'Programme 4 mois'
                              : insc.formule === 'renouvellement_12_mois_avec_prof' ? 'Renouvellement 12 mois (avec prof)'
                              : insc.formule === 'renouvellement_12_mois_sans_prof' ? 'Renouvellement 12 mois (sans prof)'
                              : insc.formule}
                            {' · '}{MODE_LABELS[insc.mode_paiement] ?? insc.mode_paiement}
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: '#16a34a' }}>
                            {EUR2(Number(insc.montant_encaisse))}
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: 'var(--dark)' }}>
                            {EUR2(Number(insc.montant_contracte))}
                          </td>
                        </tr>
                      ))
                    )}
                    {rows.length > 0 && (
                      <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg)' }}>
                        <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                          Total
                        </td>
                        <td className="px-4 py-3 font-black" style={{ color: '#16a34a' }}>
                          {EUR2(totalEncaisse)}
                        </td>
                        <td className="px-4 py-3 font-black" style={{ color: 'var(--dark)' }}>
                          {EUR2(totalContracte)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          )
        })()}

        {/* ── Charges ventilées ── */}
        <Section title="Charges">
          <div className="grid md:grid-cols-3 gap-4">

            {/* Outils */}
            <div className="rounded-2xl p-5" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Outils</span>
                <span className="text-base font-black" style={{ color: 'var(--dark)' }}>{EUR(kpis.charges_outils)}</span>
              </div>
              <div className="space-y-2">
                {outils.map(o => (
                  <div key={o.id} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted2)' }}>{o.label}</span>
                    {outilEdit === o.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={outilValues[o.id] ?? String(o.montant_annuel)}
                          onChange={e => setOutilValues(p => ({ ...p, [o.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveOutil(o.id); if (e.key === 'Escape') setOutilEdit(null) }}
                          onBlur={() => saveOutil(o.id)}
                          autoFocus
                          className="w-20 text-xs px-2 py-1 text-right rounded"
                          style={{ border: '1.5px solid var(--accent)' }}
                        />
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>€/an</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setOutilEdit(o.id); setOutilValues(p => ({ ...p, [o.id]: String(o.montant_annuel) })) }}
                        className="text-xs font-semibold hover:underline"
                        style={{ color: 'var(--dark)' }}
                        title="Cliquer pour modifier"
                      >
                        {EUR2(o.montant_mensuel)}/mois
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 flex justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Total/mois</span>
                <span className="text-xs font-bold" style={{ color: 'var(--dark)' }}>{EUR2(totalOutilsMensuel)}</span>
              </div>
            </div>

            {/* Prof */}
            <div className="rounded-2xl p-5" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Prof (Axel)</span>
                <span className="text-base font-black" style={{ color: 'var(--dark)' }}>{EUR(kpis.charges_prof)}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: 'var(--muted2)' }}>Séances</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--dark)' }}>{kpis.nb_seances_prof}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: 'var(--muted2)' }}>Tarif / séance</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--dark)' }}>22,50 €</span>
                </div>
              </div>
              <div className="mt-3 pt-3 flex justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Calculé auto</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>depuis les séances</span>
              </div>
            </div>

            {/* Meta Ads */}
            <div className="rounded-2xl p-5" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Meta Ads</span>
                <span className="text-base font-black" style={{ color: 'var(--dark)' }}>{EUR(kpis.charges_meta)}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--muted2)' }}>Budget / jour</span>
                  {metaEdit ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={metaBudget}
                        onChange={e => setMetaBudget(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveMeta(); if (e.key === 'Escape') setMetaEdit(false) }}
                        onBlur={saveMeta}
                        autoFocus
                        className="w-16 text-xs px-2 py-1 text-right rounded"
                        style={{ border: '1.5px solid var(--accent)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>€/j</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setMetaEdit(true)}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: 'var(--dark)' }}
                      title="Cliquer pour modifier"
                    >
                      {meta.budget_journalier} €/j
                    </button>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: 'var(--muted2)' }}>Jours</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--dark)' }}>{meta.nb_jours}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 flex justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Total estimé</span>
                <span className="text-xs font-bold" style={{ color: 'var(--dark)' }}>{EUR2(metaTotal)}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Échéances ── */}
        <Section title={`Échéances à venir (${echeancesAVenir.length})`}>
          <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
            <table className="w-full text-sm border-collapse" style={{ minWidth: 480 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Élève', 'Montant', 'Date prévue', 'Mode', 'Action'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {echeancesAVenir.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
                      Toutes les échéances sont encaissées
                    </td>
                  </tr>
                ) : (
                  echeancesAVenir.map((e, i) => {
                    const isOverdue = e.date_prelevement < today
                    return (
                      <tr key={e.id} style={{ borderTop: i > 0 ? '1px solid var(--border2)' : undefined }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--dark)' }}>
                          {e.eleve_nom ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--dark)' }}>
                          {EUR2(e.montant)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span style={{ color: isOverdue ? '#dc2626' : 'var(--muted2)', fontWeight: isOverdue ? 600 : 400 }}>
                            {isOverdue ? '⚠ ' : ''}{fmtShort(e.date_prelevement)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>—</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => encaisser(e.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors hover:opacity-80"
                            style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
                          >
                            Encaissé ✓
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Encaissements récents ── */}
        {echeancesRecentes.length > 0 && (
          <Section title="Encaissements récents (30 jours)">
            <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
              <table className="w-full text-sm border-collapse" style={{ minWidth: 400 }}>
                <tbody>
                  {echeancesRecentes.map((e, i) => (
                    <tr key={e.id} style={{
                      borderTop: i > 0 ? '1px solid var(--border2)' : undefined,
                      opacity: 0.6,
                    }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--dark)' }}>{e.eleve_nom ?? '—'}</td>
                      <td className="px-4 py-2.5 text-sm" style={{ color: 'var(--muted)' }}>{EUR2(e.montant)}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                        Encaissé le {fmtShort(e.date_encaissement)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right" style={{ color: '#16a34a' }}>✓</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

      </div>
    </div>
  )
}

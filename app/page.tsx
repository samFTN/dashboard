import pool from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const EUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const STATUT_LABELS: Record<string, string> = {
  non_qualifie: 'Non qualifiés',
  qualifie:     'Qualifiés',
  reserve:      'Réservés',
  present:      'Présents',
  eleve:        'Élèves',
  ancien_eleve: 'Anciens élèves',
}

const STATUT_COLORS: Record<string, string> = {
  non_qualifie: '#9ca3af',
  qualifie:     '#1d4ed8',
  reserve:      '#d97706',
  present:      '#15803d',
}

async function fetchAll() {
  const now = new Date()
  const debutMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [alertesLeads, pipeline, eleves, finances, actionsJour] = await Promise.all([
    // 1. Alertes leads
    pool.query(`
      SELECT
        COUNT(CASE WHEN prochaine_action_date::date < CURRENT_DATE
                   AND statut IN ('qualifie','reserve','present') THEN 1 END)::int AS a_relancer,
        COUNT(CASE WHEN prochaine_action_type = 'cours_essai'
                   AND prochaine_action_date::date = CURRENT_DATE THEN 1 END)::int AS cours_aujourd_hui,
        COUNT(CASE WHEN prochaine_action_date IS NULL
                   AND statut IN ('qualifie','reserve','present') THEN 1 END)::int AS sans_plan,
        COUNT(*)::int AS total_actifs,
        COUNT(CASE WHEN created_at::date = CURRENT_DATE THEN 1 END)::int AS nouveaux_aujourd_hui
      FROM leads WHERE archive = false
    `),

    // 2. Pipeline leads par statut
    pool.query(`
      SELECT statut, COUNT(*)::int AS count
      FROM leads WHERE archive = false
      GROUP BY statut
    `),

    // 3. Élèves résumé
    pool.query(`
      SELECT
        COUNT(CASE WHEN actif = true THEN 1 END)::int AS actifs,
        COUNT(CASE WHEN actif = true AND freeze_actif = true THEN 1 END)::int AS en_freeze,
        COUNT(CASE WHEN created_at::date = CURRENT_DATE THEN 1 END)::int AS nouveaux_aujourd_hui,
        (SELECT COUNT(*)::int FROM seances WHERE alerte_decrochage = true) AS alertes_decrochage
      FROM eleves
    `),

    // 4. Actions du jour (retard inclus)
    pool.query(`
      SELECT id, nom, telephone, statut, prochaine_action_type, prochaine_action_date, prochaine_action_note
      FROM leads
      WHERE archive = false
        AND prochaine_action_date::date <= CURRENT_DATE
      ORDER BY prochaine_action_date ASC
    `),

    // 6. Finances mois courant
    pool.query(`
      SELECT
        COALESCE((
          SELECT SUM(montant) FROM echeances
          WHERE encaisse = true AND date_encaissement BETWEEN $1 AND CURRENT_DATE
        ), 0)::numeric AS revenus_encaisses,
        COALESCE((
          SELECT SUM(montant) FROM echeances WHERE encaisse = false
        ), 0)::numeric AS reste_a_encaisser,
        (SELECT COUNT(*)::int FROM alertes_paiement WHERE statut = 'non_assigne') AS alertes_paiement
    `, [debutMois]),
  ])

  const al = alertesLeads.rows[0]
  const el = eleves.rows[0]
  const fi = finances.rows[0]
  const actions = actionsJour.rows

  const pipelineMap: Record<string, number> = {}
  for (const row of pipeline.rows) {
    pipelineMap[row.statut] = row.count
  }

  const totalAlertes = Number(al.a_relancer) + Number(al.cours_aujourd_hui) + Number(fi.alertes_paiement)

  return {
    leads: {
      totalActifs: Number(al.total_actifs),
      aRelancer: Number(al.a_relancer),
      coursAujourdhui: Number(al.cours_aujourd_hui),
      sansPlan: Number(al.sans_plan),
      nouveauxAujourdhui: Number(al.nouveaux_aujourd_hui),
      pipeline: pipelineMap,
    },
    eleves: {
      actifs: Number(el.actifs),
      enFreeze: Number(el.en_freeze),
      alertesDecrochage: Number(el.alertes_decrochage),
      nouveauxAujourdhui: Number(el.nouveaux_aujourd_hui),
    },
    finances: {
      revenusEncaisses: parseFloat(fi.revenus_encaisses),
      resteAEncaisser: parseFloat(fi.reste_a_encaisser),
      alertesPaiement: Number(fi.alertes_paiement),
    },
    actions,
    totalAlertes,
    dateLabel: now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

const ACTION_LABELS: Record<string, string> = { appel: 'Appel', sms: 'SMS', cours_essai: 'Cours d\'essai' }
const ACTION_COLORS: Record<string, string> = { appel: '#1d4ed8', sms: '#15803d', cours_essai: '#d97706' }

export default async function HomePage() {
  const { leads, eleves, finances, actions, totalAlertes, dateLabel } = await fetchAll()

  const PIPELINE_STATUTS = ['qualifie', 'reserve', 'present']

  return (
    <div className="px-4 md:px-8 pt-6 md:pt-8 pb-8 max-w-2xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: 'var(--dark)', letterSpacing: '-0.5px' }}>
          Bonjour Samuel
        </h1>
        <p className="text-sm mt-0.5 capitalize" style={{ color: 'var(--muted2)' }}>{dateLabel}</p>
      </div>

      {/* Alertes urgentes */}
      {totalAlertes > 0 && (
        <div
          className="rounded-2xl p-4 mb-5 flex flex-col gap-2"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#dc2626' }}>
            À traiter
          </p>
          {leads.aRelancer > 0 && (
            <Link href="/leads" className="flex items-center justify-between group">
              <span className="text-sm font-medium" style={{ color: '#dc2626' }}>
                {leads.aRelancer} lead{leads.aRelancer > 1 ? 's' : ''} à relancer
              </span>
              <span className="text-xs group-hover:underline" style={{ color: '#dc2626' }}>Voir →</span>
            </Link>
          )}
          {leads.coursAujourdhui > 0 && (
            <Link href="/leads" className="flex items-center justify-between group">
              <span className="text-sm font-medium" style={{ color: '#b45309' }}>
                {leads.coursAujourdhui} cours d&apos;essai aujourd&apos;hui
              </span>
              <span className="text-xs group-hover:underline" style={{ color: '#b45309' }}>Voir →</span>
            </Link>
          )}
          {finances.alertesPaiement > 0 && (
            <Link href="/finances" className="flex items-center justify-between group">
              <span className="text-sm font-medium" style={{ color: '#dc2626' }}>
                {finances.alertesPaiement} paiement{finances.alertesPaiement > 1 ? 's' : ''} Stripe non reconnu{finances.alertesPaiement > 1 ? 's' : ''}
              </span>
              <span className="text-xs group-hover:underline" style={{ color: '#dc2626' }}>Voir →</span>
            </Link>
          )}
        </div>
      )}

      {/* Actions du jour */}
      {actions.length > 0 && (
        <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Actions du jour · {actions.length}
            </p>
          </div>
          <div className="divide-y" style={{ background: 'var(--card)', '--tw-divide-color': 'var(--border)' } as React.CSSProperties}>
            {actions.map((a: { id: string; nom: string; telephone: string | null; statut: string; prochaine_action_type: string; prochaine_action_date: string; prochaine_action_note: string | null }) => {
              const retard = new Date(a.prochaine_action_date) < new Date(new Date().toDateString())
              return (
                <Link key={a.id} href={`/leads?id=${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:opacity-80 transition-opacity">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: ACTION_COLORS[a.prochaine_action_type] + '18', color: ACTION_COLORS[a.prochaine_action_type] }}
                  >
                    {ACTION_LABELS[a.prochaine_action_type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--dark)' }}>{a.nom}</p>
                    {a.prochaine_action_note && (
                      <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{a.prochaine_action_note}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {a.telephone && (
                      <p className="text-xs font-medium" style={{ color: 'var(--muted2)' }}>{a.telephone}</p>
                    )}
                    {retard && (
                      <p className="text-[10px] font-semibold" style={{ color: '#dc2626' }}>En retard</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Leads + Élèves */}
      <div className="grid grid-cols-2 gap-3 mb-3">

        {/* Card Leads */}
        <Link href="/leads" className="block rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Leads</p>
            {leads.nouveauxAujourdhui > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                +{leads.nouveauxAujourdhui}
              </span>
            )}
          </div>
          <p className="text-3xl font-black mb-3" style={{ color: 'var(--dark)', letterSpacing: '-1px' }}>
            {leads.totalActifs}
          </p>
          <div className="flex flex-col gap-1">
            {PIPELINE_STATUTS.map(s => {
              const count = leads.pipeline[s] ?? 0
              return (
                <div key={s} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUT_COLORS[s] }} />
                    <span className="text-[12px]" style={{ color: 'var(--muted2)' }}>{STATUT_LABELS[s]}</span>
                  </div>
                  <span className="text-[12px] font-semibold" style={{ color: count > 0 ? 'var(--dark)' : 'var(--muted)' }}>{count}</span>
                </div>
              )
            })}
            {leads.sansPlan > 0 && (
              <div className="flex items-center gap-1.5 mt-1 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-[11px]" style={{ color: '#d97706' }}>⚠ {leads.sansPlan} sans plan</span>
              </div>
            )}
          </div>
        </Link>

        {/* Card Élèves */}
        <Link href="/eleves" className="block rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Élèves</p>
            {eleves.nouveauxAujourdhui > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                +{eleves.nouveauxAujourdhui}
              </span>
            )}
          </div>
          <p className="text-3xl font-black mb-3" style={{ color: 'var(--dark)', letterSpacing: '-1px' }}>
            {eleves.actifs}
          </p>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--muted2)' }}>En freeze</span>
              <span className="text-[12px] font-semibold" style={{ color: eleves.enFreeze > 0 ? '#d97706' : 'var(--muted)' }}>
                {eleves.enFreeze}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--muted2)' }}>Alertes décrochage</span>
              <span className="text-[12px] font-semibold" style={{ color: eleves.alertesDecrochage > 0 ? '#dc2626' : 'var(--muted)' }}>
                {eleves.alertesDecrochage}
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Card Finances */}
      <Link href="/finances" className="block rounded-2xl p-4" style={{ background: 'var(--dark)', border: '1px solid var(--dark)' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
            Finances — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </p>
          {finances.alertesPaiement > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#dc2626', color: 'white' }}>
              ⚠ {finances.alertesPaiement}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] mb-1" style={{ color: '#6b7280' }}>Encaissé</p>
            <p className="text-xl font-black" style={{ color: '#4ade80', letterSpacing: '-0.5px' }}>
              {EUR(finances.revenusEncaisses)}
            </p>
          </div>
          <div>
            <p className="text-[11px] mb-1" style={{ color: '#6b7280' }}>Reste à encaisser</p>
            <p className="text-xl font-black" style={{ color: 'white', letterSpacing: '-0.5px' }}>
              {EUR(finances.resteAEncaisser)}
            </p>
          </div>
        </div>
      </Link>

    </div>
  )
}

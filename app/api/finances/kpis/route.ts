import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const debut = searchParams.get('debut')
  const fin = searchParams.get('fin')

  if (!debut || !fin) {
    return NextResponse.json({ error: 'Paramètres debut et fin requis' }, { status: 400 })
  }

  try {
    const [
      revenus,
      charges_outils,
      charges_prof,
      charges_meta,
      echeances_a_venir,
      eleves_actifs,
    ] = await Promise.all([
      // Revenus contractés (inscriptions signées dans la période)
      pool.query(
        `SELECT
          COALESCE(SUM(montant_contracte), 0)::numeric AS contractes,
          COALESCE(SUM(CASE WHEN e.encaisse = true AND e.date_encaissement BETWEEN $1 AND $2
            THEN e.montant ELSE 0 END), 0)::numeric AS encaisses,
          COALESCE(SUM(CASE WHEN e.encaisse = false THEN e.montant ELSE 0 END), 0)::numeric AS reste
        FROM inscriptions_financieres i
        LEFT JOIN echeances e ON e.inscription_id = i.id`,
        [debut, fin]
      ),
      // Charges outils (pro-rata mensuel × nb mois dans la période)
      pool.query(
        `SELECT COALESCE(SUM(montant_annuel), 0) / 12 AS cout_mensuel FROM charges_outils`
      ),
      // Charges prof (séances dans la période)
      pool.query(
        `SELECT COUNT(s.id)::int AS nb_seances
         FROM seances s
         WHERE s.date BETWEEN $1 AND $2`,
        [debut, fin]
      ),
      // Charges Meta Ads (somme des mois couverts par la période)
      pool.query(
        `SELECT
          COALESCE(SUM(
            CASE WHEN montant_realise IS NOT NULL
              THEN montant_realise
              ELSE budget_journalier * nb_jours
            END
          ), 0)::numeric AS total
        FROM charges_meta_ads
        WHERE mois >= LEFT($1, 7) AND mois <= LEFT($2, 7)`,
        [debut, fin]
      ),
      // Échéances à venir (non encaissées)
      pool.query(
        `SELECT COUNT(*)::int AS nb
         FROM echeances
         WHERE encaisse = false AND date_prelevement >= CURRENT_DATE`
      ),
      // Élèves actifs
      pool.query(`SELECT COUNT(*)::int AS nb FROM eleves WHERE actif = true`),
    ])

    const nb_mois = monthsBetween(debut, fin)
    const charges_outils_total = parseFloat(charges_outils.rows[0].cout_mensuel) * nb_mois
    const charges_prof_total = (charges_prof.rows[0].nb_seances ?? 0) * 22.5
    const charges_meta_total = parseFloat(charges_meta.rows[0].total)

    const encaisses = parseFloat(revenus.rows[0].encaisses)
    const charges_total = charges_outils_total + charges_prof_total + charges_meta_total
    const ebitda = encaisses - charges_total

    return NextResponse.json({
      revenus_contractes: parseFloat(revenus.rows[0].contractes),
      revenus_encaisses: encaisses,
      reste_a_encaisser: parseFloat(revenus.rows[0].reste),
      charges_outils: charges_outils_total,
      charges_prof: charges_prof_total,
      charges_meta: charges_meta_total,
      charges_total,
      ebitda,
      nb_seances_prof: charges_prof.rows[0].nb_seances ?? 0,
      nb_echeances_a_venir: echeances_a_venir.rows[0].nb,
      nb_eleves_actifs: eleves_actifs.rows[0].nb,
    })
  } catch (err) {
    console.error('[GET /api/finances/kpis]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function monthsBetween(debut: string, fin: string): number {
  const d = new Date(debut)
  const f = new Date(fin)
  const months = (f.getFullYear() - d.getFullYear()) * 12 + (f.getMonth() - d.getMonth()) + 1
  return Math.max(1, months)
}

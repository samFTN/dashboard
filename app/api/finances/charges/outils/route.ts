import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const SEED = [
  { id: 'podia',      nom: 'podia',      montant_annuel: 376 },
  { id: 'mailerlite', nom: 'mailerlite', montant_annuel: 298 },
  { id: 'calendly',   nom: 'calendly',   montant_annuel: 120 },
  { id: 'make',       nom: 'make',       montant_annuel: 120 },
  { id: 'zoom',       nom: 'zoom',       montant_annuel: 179 },
  { id: 'manychat',   nom: 'manychat',   montant_annuel: 168 },
]

const LABELS: Record<string, string> = {
  podia: 'Podia',
  mailerlite: 'MailerLite',
  calendly: 'Calendly',
  make: 'Make',
  zoom: 'Zoom',
  manychat: 'ManyChat',
}

export async function GET() {
  try {
    // Seed si vide
    for (const tool of SEED) {
      await pool.query(
        `INSERT INTO charges_outils (id, nom, montant_annuel)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [tool.id, tool.nom, tool.montant_annuel]
      )
    }

    const { rows } = await pool.query(
      `SELECT id, nom, montant_annuel,
              ROUND(montant_annuel / 12, 2) AS montant_mensuel,
              date_renouvellement
       FROM charges_outils
       ORDER BY montant_annuel DESC`
    )

    return NextResponse.json(
      rows.map(r => ({ ...r, label: LABELS[r.nom] ?? r.nom }))
    )
  } catch (err) {
    console.error('[GET /api/finances/charges/outils]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

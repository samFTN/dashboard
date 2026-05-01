import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const LEADS_QUERY = `
  SELECT
    l.id::text, l.nom, l.email, l.telephone,
    l.statut, l.source, l.archive,
    l.raison_archivage, l.date_archivage,
    l.cours_essai_date, l.cours_essai_fait,
    l.prochaine_action_type, l.prochaine_action_date, l.prochaine_action_note,
    l.tranche_age, l.objectifs, l.problemes, l.questionnaire,
    l.eleve_id::text,
    l.created_at, l.updated_at,
    MAX(ac.date) AS dernier_contact_date,
    COALESCE(
      json_agg(
        json_build_object(
          'id', ac.id::text,
          'type', ac.type,
          'date', ac.date,
          'note', ac.note
        ) ORDER BY ac.date DESC
      ) FILTER (WHERE ac.id IS NOT NULL),
      '[]'::json
    ) AS journal
  FROM leads l
  LEFT JOIN actions_contact ac ON ac.lead_id = l.id
  WHERE l.archive = $1
    AND ($2::text IS NULL OR l.statut = $2)
    AND ($3::text IS NULL OR l.source = $3)
  GROUP BY l.id
  ORDER BY l.created_at DESC
`

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const archive = sp.get('archive') === 'true'
  const statut = sp.get('statut') || null
  const source = sp.get('source') || null

  try {
    const { rows } = await pool.query(LEADS_QUERY, [archive, statut, source])
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/leads]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nom, email, telephone, source, tranche_age, objectifs, problemes } = body

    if (!nom?.trim() || !email?.trim() || !source) {
      return NextResponse.json({ error: 'Champs requis manquants (nom, email, source)' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Détection de doublons
    const { rows: dups } = await pool.query(
      `SELECT id::text, nom FROM leads
       WHERE (email = $1 OR ($2::text IS NOT NULL AND telephone = $2))
         AND archive = false
       LIMIT 3`,
      [normalizedEmail, telephone?.trim() || null]
    )
    if (dups.length > 0) {
      return NextResponse.json({ error: 'Doublon détecté', doublons: dups }, { status: 409 })
    }

    const { rows } = await pool.query(
      `INSERT INTO leads (nom, email, telephone, source, tranche_age, objectifs, problemes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id::text, nom, email, telephone, statut, source, archive,
         raison_archivage, date_archivage, cours_essai_date, cours_essai_fait,
         prochaine_action_type, prochaine_action_date, prochaine_action_note,
         tranche_age, objectifs, problemes, eleve_id::text,
         created_at, updated_at`,
      [
        nom.trim(), normalizedEmail, telephone?.trim() || null, source,
        tranche_age || null, objectifs?.trim() || null, problemes?.trim() || null,
      ]
    )
    const lead = { ...rows[0], dernier_contact_date: null, journal: [] }
    return NextResponse.json(lead, { status: 201 })
  } catch (err) {
    console.error('[POST /api/leads]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

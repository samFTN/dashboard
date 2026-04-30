import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { sid } = await params
  try {
    const body = await req.json()
    const { satisfaction, ressenti, participation_ateliers, date_remplissage } = body

    await pool.query(
      `INSERT INTO compte_rendu_eleve
         (seance_id, satisfaction, ressenti, participation_ateliers, date_remplissage)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (seance_id) DO UPDATE SET
         satisfaction          = EXCLUDED.satisfaction,
         ressenti              = EXCLUDED.ressenti,
         participation_ateliers = EXCLUDED.participation_ateliers,
         date_remplissage      = EXCLUDED.date_remplissage`,
      [
        sid,
        satisfaction ?? null,
        ressenti?.trim() || null,
        participation_ateliers ?? null,
        date_remplissage || null,
      ]
    )

    // Si date_remplissage fourni → efface l'alerte décrochage
    if (date_remplissage) {
      await pool.query(
        `UPDATE seances SET alerte_decrochage = false WHERE id = $1`,
        [sid]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST volet-eleve]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

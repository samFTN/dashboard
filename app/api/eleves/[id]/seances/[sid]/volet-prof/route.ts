import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { id, sid } = await params
  try {
    const body = await req.json()
    const {
      presence, remarque,
      nb_ateliers_assistes, nb_commentaires, nb_videos_feedback,
      video_defi, defi_valide, points_jeux,
    } = body

    if (presence === undefined) {
      return NextResponse.json({ error: 'Champ presence requis' }, { status: 400 })
    }

    // Upsert volet prof
    await pool.query(
      `INSERT INTO compte_rendu_prof
         (seance_id, presence, remarque, nb_ateliers_assistes,
          nb_commentaires, nb_videos_feedback, video_defi, defi_valide, points_jeux)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (seance_id) DO UPDATE SET
         presence             = EXCLUDED.presence,
         remarque             = EXCLUDED.remarque,
         nb_ateliers_assistes = EXCLUDED.nb_ateliers_assistes,
         nb_commentaires      = EXCLUDED.nb_commentaires,
         nb_videos_feedback   = EXCLUDED.nb_videos_feedback,
         video_defi           = EXCLUDED.video_defi,
         defi_valide          = EXCLUDED.defi_valide,
         points_jeux          = EXCLUDED.points_jeux`,
      [
        sid,
        presence,
        remarque?.trim() || null,
        nb_ateliers_assistes ?? 0,
        nb_commentaires ?? 0,
        nb_videos_feedback ?? 0,
        video_defi ?? false,
        defi_valide ?? false,
        points_jeux ?? 0,
      ]
    )

    // Recalcule points_total de l'élève
    await pool.query(
      `UPDATE eleves
       SET points_total = (
         SELECT COALESCE(SUM(crp.points_jeux), 0)
         FROM compte_rendu_prof crp
         JOIN seances s ON s.id = crp.seance_id
         WHERE s.eleve_id = $1
       ), updated_at = NOW()
       WHERE id = $1`,
      [id]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST volet-prof]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; freezeId: string }> }
) {
  const { id, freezeId } = await params
  try {
    const { rows } = await pool.query(
      `SELECT id, date_fin, semaines_duree FROM freezes WHERE id = $1 AND eleve_id = $2`,
      [freezeId, id]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Freeze introuvable' }, { status: 404 })
    }

    const freeze = rows[0]
    const wasActive = !freeze.date_fin
    const semaines = freeze.semaines_duree ?? 0

    await pool.query(`DELETE FROM freezes WHERE id = $1`, [freezeId])

    if (wasActive) {
      // Freeze en cours : juste désactiver le flag
      await pool.query(
        `UPDATE eleves SET freeze_actif = false, updated_at = NOW() WHERE id = $1`,
        [id]
      )
    } else if (semaines > 0) {
      // Freeze terminé : annuler l'effet sur les semaines et la date de fin
      await pool.query(
        `UPDATE eleves SET
           semaines_freeze_consommees = GREATEST(0, semaines_freeze_consommees - $1),
           date_fin_prevue = date_fin_prevue - make_interval(weeks => $1),
           updated_at = NOW()
         WHERE id = $2`,
        [semaines, id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE freeze]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

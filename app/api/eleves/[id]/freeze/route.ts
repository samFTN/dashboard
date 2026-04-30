import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { action } = await req.json()

    if (action === 'start') {
      const today = new Date().toISOString().slice(0, 10)
      await pool.query(
        `INSERT INTO freezes (eleve_id, date_debut) VALUES ($1, $2)`,
        [id, today]
      )
      await pool.query(
        `UPDATE eleves SET freeze_actif = true, updated_at = NOW() WHERE id = $1`,
        [id]
      )
      return NextResponse.json({ ok: true })
    }

    if (action === 'end') {
      const today = new Date().toISOString().slice(0, 10)

      // Trouver le freeze actif (pas de date_fin)
      const { rows } = await pool.query(
        `SELECT id, date_debut FROM freezes WHERE eleve_id = $1 AND date_fin IS NULL ORDER BY date_debut DESC LIMIT 1`,
        [id]
      )
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Aucun freeze actif' }, { status: 400 })
      }

      const freeze = rows[0]
      const debut = new Date(freeze.date_debut)
      const fin = new Date(today)
      const diffJours = Math.max(1, Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)))
      const semainesDuree = Math.ceil(diffJours / 7)

      // Mettre à jour le freeze
      await pool.query(
        `UPDATE freezes SET date_fin = $1, semaines_duree = $2 WHERE id = $3`,
        [today, semainesDuree, freeze.id]
      )

      // Mettre à jour l'élève : freeze_actif = false, semaines += semainesDuree, date_fin_prevue += semaines
      await pool.query(
        `UPDATE eleves SET
           freeze_actif = false,
           semaines_freeze_consommees = semaines_freeze_consommees + $1,
           date_fin_prevue = date_fin_prevue + make_interval(weeks => $1),
           updated_at = NOW()
         WHERE id = $2`,
        [semainesDuree, id]
      )

      return NextResponse.json({ ok: true, semainesDuree })
    }

    return NextResponse.json({ error: 'Action invalide (start | end)' }, { status: 400 })
  } catch (err) {
    console.error('[POST freeze]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

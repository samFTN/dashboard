import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const sets: string[] = []
    const values: unknown[] = [id]

    if ('montant_annuel' in body) {
      values.push(body.montant_annuel)
      sets.push(`montant_annuel = $${values.length}`)
    }
    if ('date_renouvellement' in body) {
      values.push(body.date_renouvellement || null)
      sets.push(`date_renouvellement = $${values.length}`)
    }

    if (sets.length === 0) return NextResponse.json({ error: 'Aucun champ' }, { status: 400 })

    const { rows } = await pool.query(
      `UPDATE charges_outils SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, nom, montant_annuel, ROUND(montant_annuel / 12, 2) AS montant_mensuel, date_renouvellement`,
      values
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('[PATCH /api/finances/charges/outils/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

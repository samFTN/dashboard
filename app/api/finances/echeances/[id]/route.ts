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

    if ('encaisse' in body) {
      const date = body.date_encaissement ?? new Date().toISOString().slice(0, 10)
      values.push(body.encaisse ?? true, date)
      sets.push(`encaisse = $${values.length - 1}`, `date_encaissement = $${values.length}`)
    }
    if ('montant' in body) {
      values.push(parseFloat(body.montant))
      sets.push(`montant = $${values.length}`)
    }
    if ('date_prelevement' in body) {
      values.push(body.date_prelevement)
      sets.push(`date_prelevement = $${values.length}`)
    }

    if (sets.length === 0) return NextResponse.json({ error: 'Aucun champ' }, { status: 400 })

    await pool.query(`UPDATE echeances SET ${sets.join(', ')} WHERE id = $1`, values)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/finances/echeances/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

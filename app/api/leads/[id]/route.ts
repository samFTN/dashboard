import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const ALLOWED = [
  'statut', 'source',
  'cours_essai_date', 'cours_essai_fait',
  'prochaine_action_type', 'prochaine_action_date', 'prochaine_action_note',
  'tranche_age', 'objectifs', 'problemes',
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json()
    const values: unknown[] = [id]
    const sets: string[] = []

    for (const field of ALLOWED) {
      if (field in body) {
        values.push(body[field])
        sets.push(`${field} = $${values.length}`)
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    sets.push('updated_at = NOW()')
    await pool.query(
      `UPDATE leads SET ${sets.join(', ')} WHERE id = $1`,
      values
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/leads/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/leads/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

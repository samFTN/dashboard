import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const TYPES = ['appel', 'sms', 'whatsapp', 'cours_essai']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { type, date, note } = await req.json()
    if (!TYPES.includes(type) || !date) {
      return NextResponse.json({ error: 'Champs requis manquants (type, date)' }, { status: 400 })
    }

    const { rows } = await pool.query(
      `INSERT INTO actions_contact (lead_id, type, date, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, type, date, note`,
      [id, type, date, note?.trim() || null]
    )

    await pool.query(
      `UPDATE leads SET updated_at = NOW() WHERE id = $1`,
      [id]
    )

    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error('[POST /api/leads/[id]/actions]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

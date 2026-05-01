import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { encaisse, date_encaissement } = await req.json()
    const date = date_encaissement ?? new Date().toISOString().slice(0, 10)

    await pool.query(
      `UPDATE echeances
       SET encaisse = $2, date_encaissement = $3
       WHERE id = $1`,
      [id, encaisse ?? true, date]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/finances/echeances/[id]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

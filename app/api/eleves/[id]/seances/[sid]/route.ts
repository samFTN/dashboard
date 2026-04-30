import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { id, sid } = await params
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM seances WHERE id = $1 AND eleve_id = $2`,
      [sid, id]
    )
    if (rowCount === 0) {
      return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE seance]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

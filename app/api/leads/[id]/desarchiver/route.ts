import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await pool.query(
      `UPDATE leads
       SET archive = false, raison_archivage = NULL, date_archivage = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/leads/[id]/desarchiver]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

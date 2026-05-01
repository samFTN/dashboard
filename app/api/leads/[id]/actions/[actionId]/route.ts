import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const { actionId } = await params
  try {
    await pool.query(`DELETE FROM actions_contact WHERE id = $1`, [actionId])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/leads/[id]/actions/[actionId]]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

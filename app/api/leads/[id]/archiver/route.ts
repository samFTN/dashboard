import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const RAISONS = ['non_qualifie', 'sans_reponse', 'abandon', 'budget']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { raison } = await req.json()
    if (!RAISONS.includes(raison)) {
      return NextResponse.json({ error: 'Raison invalide' }, { status: 400 })
    }

    await pool.query(
      `UPDATE leads
       SET archive = true, raison_archivage = $2, date_archivage = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, raison]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/leads/[id]/archiver]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

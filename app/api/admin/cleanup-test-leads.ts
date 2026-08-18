import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret') || req.headers.get('x-secret')
  if (secret !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Liste les leads de test créés aujourd'hui
    const { rows: testLeads } = await pool.query(
      `SELECT id, nom, email, created_at FROM leads
       WHERE email LIKE 'test-%@test.local'
       AND created_at::date = CURRENT_DATE`
    )

    if (testLeads.length === 0) {
      return NextResponse.json({ message: 'No test leads found today' })
    }

    // Supprime les leads de test
    const { rowCount } = await pool.query(
      `DELETE FROM leads WHERE email LIKE 'test-%@test.local' AND created_at::date = CURRENT_DATE`
    )

    return NextResponse.json({
      deleted: rowCount,
      leads: testLeads.map(r => ({ email: r.email, created_at: r.created_at }))
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    )
  }
}

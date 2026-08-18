import { NextResponse } from 'next/server'
import pool from '@/lib/db'

// Route publique pour debug (pas d'auth)
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = req.headers.get('x-debug-secret')
  if (secret !== '12345') {
    return NextResponse.json({ error: 'Secret requis' }, { status: 401 })
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, nom, email, statut, raison_archivage, archive, created_at
       FROM leads
       WHERE created_at::date = CURRENT_DATE
       ORDER BY created_at DESC`,
    )

    return NextResponse.json({
      total: rows.length,
      leads: rows.map(r => ({
        id: r.id,
        nom: r.nom,
        email: r.email,
        statut: r.statut,
        raison_archivage: r.raison_archivage,
        archive: r.archive,
        created_at: r.created_at,
        compte_comme_qualifie: r.raison_archivage !== 'non_qualifie'
      }))
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur DB' },
      { status: 500 }
    )
  }
}

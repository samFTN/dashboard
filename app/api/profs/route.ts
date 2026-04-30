import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(
    `SELECT id, nom FROM profs ORDER BY nom`
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  try {
    const { nom } = await req.json()
    if (!nom?.trim()) {
      return NextResponse.json({ error: 'nom requis' }, { status: 400 })
    }
    const id = nom.trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50)
    const { rows } = await pool.query(
      `INSERT INTO profs (id, nom) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET nom = EXCLUDED.nom
       RETURNING id, nom`,
      [id, nom.trim()]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error('[POST /api/profs]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

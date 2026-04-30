import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(
    `SELECT id, label, duree_mois FROM formules ORDER BY duree_mois, label`
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  try {
    const { label, duree_mois } = await req.json()
    if (!label?.trim() || !duree_mois) {
      return NextResponse.json({ error: 'label et duree_mois requis' }, { status: 400 })
    }
    // Génère un id depuis le label
    const id = label.trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50) + '_' + Date.now().toString(36)

    const { rows } = await pool.query(
      `INSERT INTO formules (id, label, duree_mois) VALUES ($1, $2, $3) RETURNING id, label, duree_mois`,
      [id, label.trim(), parseInt(duree_mois)]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error('[POST /api/formules]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

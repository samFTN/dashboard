import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(
    `SELECT id, nom FROM profs ORDER BY nom`
  )
  return NextResponse.json(rows)
}

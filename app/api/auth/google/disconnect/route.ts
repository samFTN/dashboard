import pool from '@/lib/db'
import { redirect } from 'next/navigation'

export async function GET() {
  await pool.query(`DELETE FROM settings WHERE key = 'google_refresh_token'`)
  redirect('/eleves?google=disconnected')
}

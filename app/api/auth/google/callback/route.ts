import { redirect } from 'next/navigation'
import { exchangeCode } from '@/lib/google'
import pool from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    redirect('/eleves?google=error')
  }

  const tokens = await exchangeCode(code!)
  if (!tokens.refresh_token) {
    redirect('/eleves?google=error')
  }

  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('google_refresh_token', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [tokens.refresh_token]
  )

  redirect('/eleves?google=connected')
}

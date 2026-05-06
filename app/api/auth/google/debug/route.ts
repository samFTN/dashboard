import pool from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email') ?? ''

  // Get refresh token
  const { rows } = await pool.query(`SELECT value FROM settings WHERE key = 'google_refresh_token'`)
  if (!rows[0]) return Response.json({ error: 'No refresh token stored' })

  // Get access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: rows[0].value,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) return Response.json({ error: 'Token refresh failed', tokenData })

  const token = tokenData.access_token

  // Try both endpoints
  const results: Record<string, unknown> = {}

  for (const [name, url] of [
    ['otherContacts', `https://people.googleapis.com/v1/otherContacts:search?query=${encodeURIComponent(email)}&readMask=photos,emailAddresses,names`],
    ['searchContacts', `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=photos,emailAddresses,names`],
  ] as const) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    results[name] = { status: res.status, body: await res.json() }
  }

  return Response.json(results)
}

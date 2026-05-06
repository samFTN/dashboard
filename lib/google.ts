import pool from './db'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const APP_URL = 'https://dashboard.guitarisation.fr'

export function googleAuthUrl() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/contacts.other.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCode(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${APP_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  return res.json() as Promise<{ refresh_token?: string; error?: string }>
}

async function getAccessToken(): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT value FROM settings WHERE key = 'google_refresh_token'`
  )
  if (!rows[0]) return null
  const refreshToken = rows[0].value

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string }
  return data.access_token ?? null
}

// Returns the photo URL (non-default) for a given email, or null
export async function getGooglePhotoForEmail(email: string): Promise<string | null> {
  const token = await getAccessToken()
  if (!token) return null

  // Search in "other contacts" first (people you emailed but didn't add explicitly)
  const endpoints = [
    `https://people.googleapis.com/v1/otherContacts:search?query=${encodeURIComponent(email)}&readMask=photos`,
    `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=photos`,
  ]

  for (const url of endpoints) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) continue
    const data = await res.json() as { results?: Array<{ person?: { photos?: Array<{ url: string; default?: boolean }> } }> }
    const photo = data.results?.[0]?.person?.photos?.find(p => !p.default)
    if (photo?.url) return photo.url
  }

  return null
}

export async function isGoogleConnected(): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM settings WHERE key = 'google_refresh_token'`
  )
  return rows.length > 0
}

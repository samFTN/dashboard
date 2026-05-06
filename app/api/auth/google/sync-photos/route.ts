import { getGooglePhotoForEmail } from '@/lib/google'
import pool from '@/lib/db'

export async function POST() {
  // Fetch all eleves missing a photo
  const { rows } = await pool.query<{ id: string; email: string }>(
    `SELECT id, email FROM eleves WHERE photo_url IS NULL AND actif = true`
  )

  let updated = 0
  let failed = 0

  for (const eleve of rows) {
    try {
      const url = await getGooglePhotoForEmail(eleve.email)
      if (url) {
        await pool.query(`UPDATE eleves SET photo_url = $1 WHERE id = $2`, [url, eleve.id])
        updated++
      }
    } catch {
      failed++
    }
  }

  return Response.json({ total: rows.length, updated, failed })
}

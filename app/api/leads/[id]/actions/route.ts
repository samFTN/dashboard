import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const TYPES = ['appel', 'sms', 'whatsapp', 'mail', 'cours_essai']

// Ajoute 2 jours calendaires à la date d'appel, puis repousse au lundi si le résultat tombe un week-end
function nextCallDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + 2)
  const day = d.getDay() // 0 = dimanche, 6 = samedi
  if (day === 6) d.setDate(d.getDate() + 2)
  else if (day === 0) d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { type, date, note } = await req.json()
    if (!TYPES.includes(type) || !date) {
      return NextResponse.json({ error: 'Champs requis manquants (type, date)' }, { status: 400 })
    }

    const { rows } = await pool.query(
      `INSERT INTO actions_contact (lead_id, type, date, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, type, date, note`,
      [id, type, date, note?.trim() || null]
    )

    let prochaine: { prochaine_action_type: string | null; prochaine_action_date: string | null; prochaine_action_note: string | null } | null = null
    if (type === 'appel') {
      const nextDate = nextCallDate(date)
      // Ne programme le prochain appel que s'il n'y a pas déjà une prochaine action future en place
      const { rows: updated } = await pool.query(
        `UPDATE leads
         SET updated_at = NOW(),
             prochaine_action_type = 'appel',
             prochaine_action_date = $2
         WHERE id = $1
           AND (prochaine_action_date IS NULL OR prochaine_action_date < NOW())
         RETURNING prochaine_action_type, prochaine_action_date, prochaine_action_note`,
        [id, new Date(`${nextDate}T00:00:00`).toISOString()]
      )
      if (updated.length > 0) {
        prochaine = updated[0]
      } else {
        const { rows: current } = await pool.query(
          `UPDATE leads SET updated_at = NOW() WHERE id = $1
           RETURNING prochaine_action_type, prochaine_action_date, prochaine_action_note`,
          [id]
        )
        prochaine = current[0]
      }
    } else {
      await pool.query(
        `UPDATE leads SET updated_at = NOW() WHERE id = $1`,
        [id]
      )
    }

    return NextResponse.json({ ...rows[0], ...prochaine }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/leads/[id]/actions]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

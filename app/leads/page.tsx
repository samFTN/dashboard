import pool from '@/lib/db'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'

async function fetchLeads() {
  const { rows } = await pool.query(`
    SELECT
      l.id::text, l.nom, l.email, l.telephone,
      l.statut, l.source, l.archive,
      l.raison_archivage, l.date_archivage,
      l.cours_essai_date, l.cours_essai_fait,
      l.prochaine_action_type, l.prochaine_action_date, l.prochaine_action_note,
      l.tranche_age, l.objectifs, l.problemes, l.questionnaire,
      l.eleve_id::text,
      l.created_at, l.updated_at,
      MAX(CASE WHEN ac.date <= NOW() THEN ac.date ELSE NULL END) AS dernier_contact_date,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ac.id::text,
            'type', ac.type,
            'date', ac.date,
            'note', ac.note
          ) ORDER BY ac.date DESC
        ) FILTER (WHERE ac.id IS NOT NULL),
        '[]'::json
      ) AS journal
    FROM leads l
    LEFT JOIN actions_contact ac ON ac.lead_id = l.id
    WHERE l.archive = false
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `)
  return rows
}

async function fetchTodayCount() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM leads WHERE created_at::date = CURRENT_DATE`
  )
  return rows[0].count as number
}

export default async function LeadsPage() {
  const [leads, todayCount] = await Promise.all([fetchLeads(), fetchTodayCount()])
  return <LeadsClient initialLeads={leads} todayCount={todayCount} />
}

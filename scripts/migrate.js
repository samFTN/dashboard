#!/usr/bin/env node
// scripts/migrate.js — Applique schema.sql sur la base Railway
// Usage : node scripts/migrate.js [--seed]

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const withSeed = process.argv.includes('--seed')

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL manquant dans .env.local')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })

  const client = await pool.connect()
  try {
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    console.log('▶  Application du schéma…')
    await client.query(schema)
    console.log('✅  Schéma appliqué.')

    if (withSeed) {
      const seedPath = path.join(__dirname, '..', 'db', 'seed.sql')
      const seed = fs.readFileSync(seedPath, 'utf8')
      console.log('▶  Insertion des données de test…')
      await client.query(seed)
      console.log('✅  Seed appliqué.')
    }
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((err) => {
  console.error('❌  Erreur :', err.message)
  process.exit(1)
})

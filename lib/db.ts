import { Pool, types } from 'pg'

// Retourner les dates/timestamps comme strings ISO, pas comme objets Date
types.setTypeParser(1082, (v) => v) // date
types.setTypeParser(1114, (v) => v) // timestamp
types.setTypeParser(1184, (v) => v) // timestamptz

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

const pool =
  globalThis._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis._pgPool = pool
}

export default pool

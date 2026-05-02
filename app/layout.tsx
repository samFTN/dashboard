import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import './globals.css'
import NavLink from './components/NavLink'
import MobileNav from './components/MobileNav'
import pool from '@/lib/db'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'Dashboard — Guitarisation™',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

async function fetchTodayCounts() {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM leads      WHERE created_at::date = CURRENT_DATE)::int AS leads,
        (SELECT COUNT(*) FROM eleves     WHERE created_at::date = CURRENT_DATE)::int AS eleves,
        (SELECT COUNT(*) FROM echeances  WHERE date_encaissement = CURRENT_DATE)::int AS finances
    `)
    return rows[0] as { leads: number; eleves: number; finances: number }
  } catch {
    return { leads: 0, eleves: 0, finances: 0 }
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const today = await fetchTodayCounts()
  return (
    <html lang="fr" className={`${inter.className} h-full`}>
      <body className="h-full flex overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        {/* Sidebar — desktop only */}
        <aside
          className="hidden md:flex md:w-52 shrink-0 flex-col"
          style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
        >
          <div className="px-5 py-4 flex flex-col items-center" style={{ borderBottom: '1px solid var(--border)' }}>
            <Image
              src="/logo.png"
              alt="Logo Guitarisation™"
              width={120}
              height={48}
              className="object-contain"
              priority
            />
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>Dashboard interne</p>
          </div>

          <nav className="flex-1 p-2 space-y-0.5">
            <NavLink href="/leads" badge={today.leads}>Leads</NavLink>
            <NavLink href="/eleves" badge={today.eleves}>Élèves</NavLink>
            <NavLink href="/finances" badge={today.finances}>Finances</NavLink>
          </nav>

          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--dark)' }}>Samuel Ferton</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>SF PROD (EURL)</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <MobileNav badges={{ '/leads': today.leads, '/eleves': today.eleves, '/finances': today.finances }} />
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NavLink from './components/NavLink'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'Dashboard — Guitarisation™',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.className} h-full`}>
      <body className="h-full flex overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        {/* Sidebar */}
        <aside
          className="w-52 shrink-0 flex flex-col"
          style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="text-lg font-black" style={{ letterSpacing: '-0.5px', color: 'var(--dark)' }}>
              Guitar<span style={{ color: 'var(--accent)' }}>isation</span>™
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Dashboard interne</p>
          </div>

          <nav className="flex-1 p-2 space-y-0.5">
            <NavLink href="/leads">Pipeline Leads</NavLink>
            <NavLink href="/eleves">Élèves</NavLink>
            <NavLink href="/finances">Finances</NavLink>
          </nav>

          <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--dark)' }}>Samuel Ferton</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>SF PROD (EURL)</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  )
}

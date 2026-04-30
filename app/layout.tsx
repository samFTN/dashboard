import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
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

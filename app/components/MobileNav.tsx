'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    href: '/leads',
    label: 'Leads',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/eleves',
    label: 'Élèves',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 0 1 .665 6.479A11.952 11.952 0 0 0 12 20.055a11.952 11.952 0 0 0-6.824-2.998 12.078 12.078 0 0 1 .665-6.479L12 14z" />
      </svg>
    ),
  },
  {
    href: '/finances',
    label: 'Finances',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
]

export default function MobileNav({ badges }: { badges?: Record<string, number> }) {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
      style={{
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        height: 60,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href)
        const badge = badges?.[href]
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
            style={{
              color: active ? 'var(--accent)' : 'var(--muted)',
              fontSize: 10,
              fontWeight: active ? 700 : 500,
            }}
          >
            <span className="relative">
              {icon}
              {badge != null && badge > 0 && (
                <span
                  className="absolute -top-1 -right-2 text-[9px] font-bold leading-none px-1 py-px rounded-full"
                  style={{ background: 'var(--accent)', color: '#fff', minWidth: 14, textAlign: 'center' }}
                >
                  {badge}
                </span>
              )}
            </span>
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

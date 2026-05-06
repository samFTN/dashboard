import { redirect } from 'next/navigation'
import { googleAuthUrl } from '@/lib/google'

export async function GET() {
  redirect(googleAuthUrl())
}

'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SidebarProvider } from '@/components/ui/sidebar'
import Sidebar from './components/Sidebar'
import { getSupabase } from './auth'
import { Notification } from './components/Notification'
import { useUser } from './hooks/useUser'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: isLoading, fetchUser } = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = getSupabase()

  useEffect(() => {
    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchUser()
      }
      
      // Handle auth state changes
      if (session) {
        if (pathname === '/login' || pathname === '/signup') {
          router.replace('/')
        }
      } else if (!pathname?.startsWith('/login') && !pathname?.startsWith('/signup')) {
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [pathname])

  if (isLoading) {
    return (
      <html lang="en">
        <body>
          <div className="flex items-center justify-center min-h-screen">
            Loading...
          </div>
        </body>
      </html>
    )
  }

  // Don't show sidebar on login/signup pages
  if (pathname === '/login' || pathname === '/signup') {
    return (
      <html lang="en">
        <body>
          <Notification />
          {children}
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body>
        <Notification />
        <SidebarProvider >
          <div className="flex h-screen">
            {user && <Sidebar />}
            <main className="flex-1 overflow-auto min-w-[85vw]">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}

import './globals.css'
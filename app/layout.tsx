'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SidebarProvider } from '@/components/ui/sidebar'
import Sidebar from './components/Sidebar'
import { getSupabase } from './auth'
import { Notification } from './components/Notification'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = getSupabase()

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('📱 Layout - Checking session')
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        console.log('📱 Layout - Session check result:', {
          hasSession: !!currentSession,
          pathname,
          timestamp: new Date().toISOString()
        })

        setSession(currentSession)

        // Handle authentication routing
        if (currentSession) {
          if (pathname === '/login' || pathname === '/signup') {
            console.log('📱 Layout - Redirecting to home from auth page')
            router.replace('/')
          }
        } else if (!pathname?.startsWith('/login') && !pathname?.startsWith('/signup')) {
          console.log('📱 Layout - Redirecting to login')
          router.replace('/login')
        }
      } catch (error) {
        console.error('📱 Layout - Session check error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('📱 Layout - Auth state change:', { event, hasSession: !!session })
      setSession(session)
      
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
  }, [pathname]) // Remove isRedirecting from dependencies

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
        <SidebarProvider>
          <div className="flex h-screen">
            {session && <Sidebar />}
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}



import './globals.css'
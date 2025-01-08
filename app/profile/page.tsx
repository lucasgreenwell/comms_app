'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, getSupabase } from '../auth'
import { Button } from '@/components/ui/button'
import { themes, Theme } from '../config/themes'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'

const THEME_STORAGE_KEY = 'slack-clone-theme'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'slate'
    }
    return 'slate'
  })
  const [displayName, setDisplayName] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, selectedTheme)
  }, [selectedTheme])

  const fetchUser = async () => {
    const currentUser = await getCurrentUser()
    setUser(currentUser)
    setDisplayName(currentUser?.display_name || '')
  }

  const handleLogout = async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId)
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const handleDisplayNameChange = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('users')
        .update({ display_name: displayName })
        .eq('id', user.id)

      if (error) throw error

      await fetchUser()
      toast.success('Display name updated successfully!')
    } catch (error) {
      console.error('Error updating display name:', error)
      toast.error('Failed to update display name')
    }
  }

  if (!user) return <div>Loading...</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
      
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">User Information</h2>
        <form onSubmit={handleDisplayNameChange}>
          <div className="mb-4">
            <Label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full"
            />
          </div>
          <Button type="submit">Update Display Name</Button>
        </form>
        <p className="text-gray-600 dark:text-gray-300 mt-4">
          Email: {user.email}
        </p>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Sidebar Theme</h2>
        <RadioGroup
          value={selectedTheme}
          onValueChange={handleThemeChange}
          className="grid grid-cols-2 gap-4 md:grid-cols-3"
        >
          {themes.map((theme) => (
            <div key={theme.id} className="relative">
              <RadioGroupItem
                value={theme.id}
                id={theme.id}
                className="peer sr-only"
              />
              <Label
                htmlFor={theme.id}
                className={`
                  flex flex-col items-center justify-center rounded-lg border-2 border-muted
                  p-4 hover:bg-accent hover:text-accent-foreground
                  peer-data-[state=checked]:border-primary
                  ${theme.colors.background} ${theme.colors.foreground}
                  cursor-pointer transition-all
                `}
              >
                <span className="mt-2">{theme.name}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </Card>

      <Button onClick={handleLogout} variant="destructive">
        Logout
      </Button>
    </div>
  )
}


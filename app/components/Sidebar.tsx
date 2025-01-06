'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase, getCurrentUser } from '../auth'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, LogOut } from 'lucide-react'
import { themes } from '../config/themes'

interface Channel {
  id: string
  name: string
}

export default function Sidebar() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return themes.find(t => t.id === localStorage.getItem('slack-clone-theme')) || themes[0]
    }
    return themes[0]
  })
  const router = useRouter()

  useEffect(() => {
    fetchChannels()
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    const handleStorageChange = () => {
      const themeId = localStorage.getItem('slack-clone-theme')
      setTheme(themes.find(t => t.id === themeId) || themes[0])
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const fetchCurrentUser = async () => {
    const user = await getCurrentUser()
    setCurrentUser(user)
  }

  const fetchChannels = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('channels')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error

      setChannels(data || [])
    } catch (error) {
      setError('Failed to fetch channels')
      console.error('Error fetching channels:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('channels')
        .insert({ name: newChannelName.trim() })

      if (error) throw error

      setNewChannelName('')
      setIsDialogOpen(false)
      fetchChannels()
    } catch (error) {
      console.error('Error creating channel:', error)
      setError('Failed to create channel')
    }
  }

  const handleLogout = async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <aside className={`w-64 ${theme.colors.background} ${theme.colors.foreground} p-4 flex flex-col h-full`}>
      <h2 className="text-xl font-bold mb-4">Channels</h2>
      <ul className="mb-4 flex-1 overflow-y-auto">
        {channels.map((channel) => (
          <li key={channel.id} className="mb-2">
            <Link 
              href={`/channel/${channel.id}`} 
              className={`block p-2 rounded ${theme.colors.accent} transition-colors`}
            >
              # {channel.name}
            </Link>
          </li>
        ))}
      </ul>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full mb-4">Create Channel</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new channel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateChannel}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create Channel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Link href="/profile">
        <Button variant="ghost" className="w-full flex items-center justify-start mb-2">
          <User className="mr-2" />
          {currentUser?.email || 'Profile'}
        </Button>
      </Link>
      <Button variant="ghost" className="w-full flex items-center justify-start" onClick={handleLogout}>
        <LogOut className="mr-2" />
        Logout
      </Button>
    </aside>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '../auth'
import Link from 'next/link'
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

interface Channel {
  id: string
  name: string
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    fetchChannels()
  }, [])

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

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-800 text-white p-4">
        <h2 className="text-xl font-bold mb-4">Channels</h2>
        <ul className="mb-4">
          {channels.map((channel) => (
            <li key={channel.id} className="mb-2">
              <Link href={`/channel/${channel.id}`} className="hover:text-gray-300 transition-colors">
                # {channel.name}
              </Link>
            </li>
          ))}
        </ul>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">Create Channel</Button>
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
      </aside>
      <main className="flex-1 p-4 overflow-auto">{children}</main>
    </div>
  )
}


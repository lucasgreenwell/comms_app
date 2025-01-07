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
import { User, LogOut, Plus, MessageSquare } from 'lucide-react'
import { themes } from '../config/themes'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import StartChatModal from './StartChatModal'
import { usePresence } from '../hooks/usePresence'

interface Channel {
  id: string
  name: string
  is_member?: boolean
}

interface DirectMessage {
  conversation_id: string
  type: 'dm' | 'group'
  name: string | null
  participants: {
    id: string
    email: string
  }[]
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
  const [showAllChannels, setShowAllChannels] = useState(false)
  const [allChannels, setAllChannels] = useState<Channel[]>([])
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([])
  const [isStartChatOpen, setIsStartChatOpen] = useState(false)
  const { onlineUsers } = usePresence()

  useEffect(() => {
    fetchChannels()
    fetchCurrentUser()
    fetchDirectMessages()
    const supabase = getSupabase()
    
    // Set up subscription for channel membership changes
    const channel = supabase
      .channel('channel_members_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'channel_members'
        }, 
        () => {
          fetchChannels() // Refresh channels when memberships change
        }
      )
      .subscribe()

    // Add DM subscriptions for both conversations and participants
    const dmChannel = supabase
      .channel('conversation_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversations'
        }, 
        () => {
          fetchDirectMessages()
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversation_participants'
        }, 
        () => {
          fetchDirectMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(dmChannel)
    }
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
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      // Fetch all channels
      const { data: allChannelsData, error: allChannelsError } = await supabase
        .from('channels')
        .select('id, name')
        .order('name', { ascending: true })

      if (allChannelsError) throw allChannelsError

      // Fetch user's channel memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id)

      if (membershipError) throw membershipError

      const userChannelIds = new Set(memberships.map(m => m.channel_id))
      const channelsWithMembership = allChannelsData.map(channel => ({
        ...channel,
        is_member: userChannelIds.has(channel.id)
      }))

      setAllChannels(channelsWithMembership)
      setChannels(channelsWithMembership.filter(channel => channel.is_member))
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
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      // Create the channel
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .insert({ name: newChannelName.trim() })
        .select()
        .single()

      if (channelError) throw channelError

      // Add the creator as a member
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({ channel_id: channelData.id, user_id: user.id })

      if (memberError) throw memberError

      setNewChannelName('')
      setIsDialogOpen(false)
      await fetchChannels()
      router.push(`/channel/${channelData.id}`) // Navigate to the new channel
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

  const handleJoinChannel = async (channelId: string) => {
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      const { error } = await supabase
        .from('channel_members')
        .insert({ channel_id: channelId, user_id: user.id })

      if (error) throw error

      await fetchChannels()
      router.push(`/channel/${channelId}`)
    } catch (error) {
      console.error('Error joining channel:', error)
      setError('Failed to join channel')
    }
  }

  const fetchDirectMessages = async () => {
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      // First get all conversations the user is part of
      const { data: userConversations, error: conversationsError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversation:conversations (
            type,
            name
          )
        `)
        .eq('user_id', user.id)

      if (conversationsError) throw conversationsError

      // Then get all participants for these conversations
      const conversationIds = userConversations?.map(conv => conv.conversation_id) || []
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          users!conversation_participants_user_id_fkey (
            id,
            email
          )
        `)
        .neq('user_id', user.id)
        .in('conversation_id', conversationIds)

      if (participantsError) throw participantsError

      // Group participants by conversation
      const participantsByConversation = participants?.reduce((acc, p) => {
        const participant = Array.isArray(p.users) ? p.users[0] : p.users
        if (!acc[p.conversation_id]) {
          acc[p.conversation_id] = []
        }
        acc[p.conversation_id].push(participant)
        return acc
      }, {} as Record<string, { id: string; email: string }[]>)

      // Combine conversation info with participants
      const processedDMs = userConversations?.map(conv => ({
        conversation_id: conv.conversation_id,
        type: conv.conversation.type,
        name: conv.conversation.name,
        participants: participantsByConversation[conv.conversation_id] || []
      })) || []

      setDirectMessages(processedDMs as DirectMessage[])
    } catch (error) {
      console.error('Error fetching DMs:', error)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <aside className={`w-64 ${theme.colors.background} ${theme.colors.foreground} p-4 flex flex-col h-full`}>
      <h2 className="text-xl font-bold mb-4">Channels</h2>
      <ul className="mb-2 overflow-y-auto max-h-[150px]">
        {channels.map((channel) => (
          <li key={channel.id} className="mb-2">
            <Link 
              href={`/channel/${channel.id}`} 
              className={`block p-2 rounded ${theme.colors.accent} transition-colors hover:bg-opacity-80`}
            >
              <span className="text-sm"># {channel.name}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t pt-2">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sm font-normal h-8 px-2 hover:bg-opacity-80"
          onClick={() => setShowAllChannels(!showAllChannels)}
        >
          {showAllChannels ? '↓ Hide Channels' : '→ Show All Channels'}
        </Button>

        {showAllChannels && (
          <ul className="py-1">
            {allChannels
              .filter(channel => !channel.is_member)
              .map((channel) => (
                <li key={channel.id} className="flex items-center px-2 h-8">
                  <span className="flex-1 text-sm"># {channel.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleJoinChannel(channel.id)}
                    className="h-4 w-4 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </li>
              ))}
          </ul>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-start text-sm font-normal h-8 px-2 hover:bg-opacity-80">+ Create Channel</Button>
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
      </div>

      <div className="border-t pt-2 mt-8 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Direct Messages</h2>
          <button
            onClick={() => setIsStartChatOpen(true)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <ul className="mb-2 overflow-y-auto flex-1">
          {directMessages.map((dm) => (
            <li key={dm.conversation_id} className="mb-2">
              <Link 
                href={`/dm/${dm.conversation_id}`} 
                className={`block p-2 rounded ${theme.colors.accent} transition-colors hover:bg-opacity-80`}
              >
                <div className="flex items-center">
                  {dm.type === 'dm' ? (
                    <>
                      <span className="text-sm">{dm.participants[0]?.email}</span>
                      {onlineUsers.has(dm.participants[0]?.id) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="ml-2 text-green-500">●</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Online</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </>
                  ) : (
                    <div>
                      <span className="text-sm font-medium">{dm.name || 'Group Chat With'}</span>
                      <div className="text-xs">
                        {dm.participants.map(p => p.email).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <StartChatModal
        isOpen={isStartChatOpen}
        onClose={() => setIsStartChatOpen(false)}
      />

      <Link href="/profile">
        <Button variant="ghost" className="w-full flex items-center justify-start text-sm font-normal h-8 px-2 mb-1">
          <User className="mr-2 h-4 w-4" />
          {currentUser?.email || 'Profile'}
        </Button>
      </Link>
      <Button variant="ghost" className="w-full flex items-center justify-start text-sm font-normal h-8 px-2" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </aside>
  )
}


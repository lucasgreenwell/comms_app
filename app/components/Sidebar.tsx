'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '../auth'
import { useUser } from '../hooks/useUser'
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
import { User, LogOut, Plus, MessageSquare, Search } from 'lucide-react'
import { themes } from '../config/themes'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import StartChatModal from './StartChatModal'
import { usePresence } from '../hooks/usePresence'
import SearchModal from './SearchModal'
import UserDisplay from './UserDisplay'

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
    display_name?: string
  }[]
  unread_count?: number
}

interface Post {
  id: string
  content: string
  channel_id: string
}

export default function Sidebar() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingDMs, setLoadingDMs] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { user: currentUser } = useUser()
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
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchChannels()
    fetchDirectMessages()
    fetchUnreadCounts()
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
          fetchChannels()
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
        (payload) => {
          if (!payload.new || !('last_read_at' in payload.new)) {
            fetchDirectMessages()
          }
          fetchUnreadCounts()
        }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          fetchUnreadCounts()
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

  const fetchChannels = async () => {
    setLoadingChannels(true)
    setError(null)
    try {
      if (!currentUser) throw new Error('No user found')

      const supabase = getSupabase()

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
        .eq('user_id', currentUser.id)

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
      setLoadingChannels(false)
    }
  }

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    try {
      if (!currentUser) throw new Error('No user found')

      const supabase = getSupabase()

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
        .insert({ channel_id: channelData.id, user_id: currentUser.id })

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
      if (!currentUser) throw new Error('No user found')

      const supabase = getSupabase()

      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({ channel_id: channelId, user_id: currentUser.id })

      if (memberError) throw memberError

      await fetchChannels()
      router.push(`/channel/${channelId}`)
    } catch (error) {
      console.error('Error joining channel:', error)
      setError('Failed to join channel')
    }
  }

  const fetchDirectMessages = async () => {
    setLoadingDMs(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      // Use the Supabase function to fetch conversations and participants
      const { data: conversations, error } = await supabase
        .rpc('fetch_user_conversations', { user_id: user.id })

      if (error) throw error

      // Process the data to group participants by conversation
      const participantsByConversation = conversations.reduce((acc: Record<string, { id: string; email: string; display_name?: string }[]>, conv: any) => {
        if (!acc[conv.conversation_id]) {
          acc[conv.conversation_id] = []
        }
        acc[conv.conversation_id].push({
          id: conv.participant_id,
          email: conv.participant_email,
          display_name: conv.participant_display_name
        })
        return acc
      }, {});

      // Combine conversation info with participants
      const processedDMs = Object.keys(participantsByConversation).map((conversation_id: string) => ({
        conversation_id,
        type: conversations.find((conv: any) => conv.conversation_id === conversation_id)?.type,
        name: conversations.find((conv: any) => conv.conversation_id === conversation_id)?.name,
        participants: participantsByConversation[conversation_id].map((participant: { id: string; email: string; display_name?: string }) => ({
          ...participant
        }))
      }));

      setDirectMessages(processedDMs as DirectMessage[])
    } catch (error) {
      console.error('Error fetching DMs:', error)
    } finally {
      setLoadingDMs(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, content, channel_id')
        .ilike('content', `%${searchQuery}%`)
        .in('channel_id', channels.map(c => c.id))

      if (error) throw error
      setSearchResults(posts || [])
    } catch (error) {
      console.error('Error searching posts:', error)
      setError('Failed to search posts')
    }
  }

  const fetchUnreadCounts = async () => {
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data, error } = await supabase
        .rpc('get_unread_counts_for_user', {
          p_user_id: user.id
        })

      if (error) {
        console.error('Error fetching unread counts:', error)
        return
      }

      const countsMap = data.reduce((acc: Record<string, number>, item: any) => {
        acc[item.conversation_id] = item.unread_count
        return acc
      }, {})

      setUnreadCounts(countsMap)
    } catch (error) {
      console.error('Error in fetchUnreadCounts:', error)
    }
  }

  if (error) return <div className="text-red-500">{error}</div>

  return (
    <aside className={`min-w-[15vw] ${theme.colors.background} ${theme.colors.foreground} p-4 flex flex-col h-full`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Channels</h2>
        <Button onClick={() => setIsSearchOpen(true)} variant="ghost" size="icon">
          <Search className="h-5 w-5" />
        </Button>
      </div>
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <ul className="mb-2 overflow-y-auto max-h-[150px]">
        {loadingChannels ? (
          <div className="p-2 text-sm text-gray-500">Loading channels...</div>
        ) : (
          channels.map((channel) => (
            <li key={channel.id} className="mb-2">
              <Link 
                href={`/channel/${channel.id}`} 
                className={`block p-2 rounded ${theme.colors.accent} transition-colors hover:bg-opacity-80`}
              >
                <span className="text-sm"># {channel.name}</span>
              </Link>
            </li>
          ))
        )}
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
          {loadingDMs ? (
            <div className="p-2 text-sm text-gray-500">Loading messages...</div>
          ) : (
            directMessages.map((dm) => (
              <li key={dm.conversation_id} className="mb-2">
                <Link 
                  href={`/dm/${dm.conversation_id}`} 
                  className={`block p-2 rounded ${theme.colors.accent} transition-colors hover:bg-opacity-80 relative`}
                >
                  <div className="flex items-center">
                    {dm.type === 'group' ? (
                      <div>
                        <span className="text-sm font-medium">{dm.name || 'Group Chat With'}</span>
                        <div className="text-xs">
                          {dm.participants.map(p => p.display_name || p.email).join(', ')}
                        </div>
                      </div>
                    ) : (
                      <UserDisplay 
                        user={dm.participants[0]}
                        isOnline={onlineUsers.has(dm.participants[0]?.id)}
                      />
                    )}
                    {unreadCounts[dm.conversation_id] > 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCounts[dm.conversation_id]}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

      <StartChatModal
        isOpen={isStartChatOpen}
        onClose={() => setIsStartChatOpen(false)}
      />

      <Link href="/profile">
        <Button variant="ghost" className="w-full flex items-center justify-start text-sm font-normal h-8 px-2 mb-1">
          <User className="mr-2 h-4 w-4" />
          Profile
        </Button>
      </Link>
      <Button variant="ghost" className="w-full flex items-center justify-start text-sm font-normal h-8 px-2" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </aside>
  )
}


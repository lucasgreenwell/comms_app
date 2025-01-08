'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '../auth'
import { X } from 'lucide-react'
import { themes } from '../config/themes'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  display_name?: string | null
}

interface StartChatModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function StartChatModal({ isOpen, onClose }: StartChatModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [theme] = useState(() => {
    if (typeof window !== 'undefined') {
      return themes.find(t => t.id === localStorage.getItem('slack-clone-theme')) || themes[0]
    }
    return themes[0]
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const fetchUsers = async () => {
    const supabase = getSupabase()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name')
      .neq('id', currentUser?.id)
      .order('email')

    if (error) {
      console.error('Error fetching users:', error)
      return
    }

    setUsers(data || [])
  }

  const handleStartChat = async () => {
    if (selectedUsers.length === 0) return

    setIsLoading(true)
    const supabase = getSupabase()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    try {
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: selectedUsers.length === 1 ? 'dm' : 'group',
          name: selectedUsers.length === 1 ? null : `Group Chat`
        })
        .select()
        .single()

      if (convError) throw convError

      const participants = [
        { conversation_id: conversation.id, user_id: currentUser?.id },
        ...selectedUsers.map(user => ({
          conversation_id: conversation.id,
          user_id: user.id
        }))
      ]

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants)

      if (partError) throw partError

      onClose()
      setSelectedUsers([])
      router.push(`/dm/${conversation.id}`)
    } catch (error) {
      console.error('Error creating conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className={`${theme.colors.background} ${theme.colors.foreground} rounded-lg p-6 w-96`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Start a New Chat</h2>
          <button 
            onClick={onClose} 
            className={`${theme.colors.accent} hover:bg-opacity-80 p-1 rounded`}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Selected users */}
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedUsers.map(user => (
            <div 
              key={user.id} 
              className="bg-indigo-100 rounded-full px-3 py-1 text-sm flex items-center text-indigo-700"
            >
              <span>{user.display_name || user.email}</span>
              <button
                onClick={() => setSelectedUsers(users => users.filter(u => u.id !== user.id))}
                className="ml-2 hover:bg-indigo-50 p-1 rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* User list */}
        <div className="max-h-64 overflow-y-auto mb-4 rounded border bg-white">
          {users.map(user => (
            <div
              key={user.id}
              className={`p-3 cursor-pointer transition-colors text-gray-800 ${
                selectedUsers.find(u => u.id === user.id) 
                  ? theme.colors.accent
                  : 'hover:bg-gray-200'
              }`}
              onClick={() => {
                if (selectedUsers.find(u => u.id === user.id)) {
                  setSelectedUsers(users => users.filter(u => u.id !== user.id))
                } else {
                  setSelectedUsers([...selectedUsers, user])
                }
              }}
            >
              {user.display_name || user.email}
            </div>
          ))}
        </div>

        <button
          onClick={handleStartChat}
          disabled={selectedUsers.length === 0 || isLoading}
          className={`w-full ${theme.colors.accent} p-2 rounded disabled:opacity-50 hover:bg-opacity-80`}
        >
          {isLoading ? 'Creating...' : 'Start Chat'}
        </button>
      </div>
    </div>
  )
} 
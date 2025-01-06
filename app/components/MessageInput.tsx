'use client'

import { useState } from 'react'
import { getSupabase, getCurrentUser } from '../auth'

export default function MessageInput({ channelId }: { channelId: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setSending(true)
    setError(null)

    try {
      const supabase = getSupabase()
      const user = await getCurrentUser()

      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('posts')
        .insert({
          channel_id: channelId,
          user_id: user.id,
          content: message.trim()
        })

      if (error) throw error

      setMessage('')
    } catch (error) {
      setError('Failed to send message')
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <div className="flex items-center">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded-l"
          disabled={sending}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-r hover:bg-blue-600 transition-colors"
          disabled={sending}
        >
          Send
        </button>
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </form>
  )
}


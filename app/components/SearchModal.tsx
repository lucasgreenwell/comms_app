import { useState, useEffect } from 'react'
import { getSupabase } from '../auth'
import { X } from 'lucide-react'
import { themes } from '../config/themes'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Post {
  id: string
  content: string
  channel_id: string
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [theme] = useState(() => {
    if (typeof window !== 'undefined') {
      return themes.find(t => t.id === localStorage.getItem('slack-clone-theme')) || themes[0]
    }
    return themes[0]
  })

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsLoading(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, content, channel_id')
        .ilike('content', `%${searchQuery}%`)

      if (error) throw error
      setSearchResults(posts || [])
    } catch (error) {
      console.error('Error searching posts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

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
  }, [isOpen])

  const handleResultClick = (channelId: string) => {
    onClose()
    router.push(`/channel/${channelId}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className={`${theme.colors.background} ${theme.colors.foreground} rounded-lg p-6 w-96`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Search Posts</h2>
          <button 
            onClick={onClose} 
            className={`${theme.colors.accent} hover:bg-opacity-80 p-1 rounded`}
          >
            <X className="h-6 w-6 text-gray-800" />
          </button>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-2 border rounded mb-4 text-gray-800"
          placeholder="Search posts..."
        />
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className={`w-full ${theme.colors.accent} p-2 rounded mb-4 disabled:opacity-50 hover:bg-opacity-80 text-gray-800`}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>

        {/* Display search results */}
        <div className="max-h-64 overflow-y-auto mb-4 rounded border bg-white">
          {searchResults.map(post => (
            <div key={post.id} onClick={() => handleResultClick(post.channel_id)} className="p-3 cursor-pointer transition-colors hover:bg-gray-200 text-gray-800">
              {post.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 
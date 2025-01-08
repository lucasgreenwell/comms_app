import { useState, useEffect } from 'react'
import { getSupabase } from '../auth'
import { X } from 'lucide-react'
import { themes } from '../config/themes'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MessageDisplay from './MessageDisplay'

interface Post {
  id: string
  content: string
  channel_id: string
  user_id: string
  user: {
    id: string
    display_name: string
    email?: string
  }
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
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsLoading(true)
    setHasSearched(true)
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, content, channel_id, user_id')
        .ilike('content', `%${searchQuery}%`)

      if (error) throw error

      const userIds = posts.map(post => post.user_id)
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', userIds)

      if (userError) throw userError

      const postsWithUser = posts.map(post => ({
        ...post,
        user: users.find(u => u.id === post.user_id) || { id: '', display_name: '' }
      }))

      setSearchResults(postsWithUser || [])
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

  const handleClose = () => {
    onClose();
    setSearchQuery('');
    setSearchResults([]);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.getElementById('search-input')?.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleResultClick = (post: Post) => {
    onClose()
    setSearchQuery('')
    setSearchResults([])
    router.push(`/channel/${post.channel_id}?thread=${post.id}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className={`${theme.colors.background} ${theme.colors.foreground} rounded-lg p-6 w-96`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Search Posts</h2>
          <button 
            onClick={handleClose} 
            className={`${theme.colors.accent} hover:bg-opacity-80 p-1 rounded`}
          >
            <X className="h-6 w-6 text-gray-800" />
          </button>
        </div>

        <input
          id="search-input"
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

        {/* Display search results or no results message */}
        {searchResults.length === 0 && !isLoading && hasSearched && (
          <div className="text-center text-gray-500">No results found</div>
        )}
        {searchResults.map(post => (
          <div
            key={post.id}
            onClick={() => handleResultClick(post)}
            className="cursor-pointer"
          >
            <MessageDisplay
              id={post.id}
              content={post.content}
              user={post.user}
              currentUser={null}
              messageType="post"
              onUpdate={() => {}}
              tableName="posts"
              onThreadOpen={() => handleResultClick(post)}
            />
          </div>
        ))}
      </div>
    </div>
  )
} 
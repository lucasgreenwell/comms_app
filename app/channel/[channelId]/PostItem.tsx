import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Edit2, Trash2, X, Check, MessageSquare, Download, FileIcon } from 'lucide-react'
import { getCurrentUser, getSupabase } from '../../auth'
import { useToast } from "@/components/ui/use-toast"
import { themes } from '../../config/themes'

interface Post {
  id: string
  user_id: string
  content: string
  user: {
    id: string
    email: string
  }
  files?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    path: string
  }[]
}

interface PostItemProps {
  post: Post
  onPostUpdate: () => void
  onThreadOpen: (post: Post) => void
}

export default function PostItem({ post, onPostUpdate, onThreadOpen }: PostItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(post.content)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [threadCount, setThreadCount] = useState(0)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return themes.find(t => t.id === localStorage.getItem('slack-clone-theme')) || themes[0]
    }
    return themes[0]
  })
  const { toast } = useToast()

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user))
    fetchThreadCount()

    const handleStorageChange = () => {
      const themeId = localStorage.getItem('slack-clone-theme')
      setTheme(themes.find(t => t.id === themeId) || themes[0])
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const isOwner = currentUser?.id === post.user_id

  const fetchThreadCount = async () => {
    try {
      const supabase = getSupabase()
      const { count, error } = await supabase
        .from('post_thread_comments')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id)

      if (error) throw error
      setThreadCount(count || 0)
    } catch (error) {
      console.error('Error fetching thread count:', error)
    }
  }

  const handleEdit = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('posts')
        .update({ content: editedContent })
        .eq('id', post.id)

      if (error) throw error
      
      setIsEditing(false)
      onPostUpdate()
    } catch (error) {
      console.error('Error updating post:', error)
    }
  }

  const handleDelete = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)

      if (error) throw error
      
      onPostUpdate()
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedContent(post.content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEdit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleDownload = async (file: { path: string; file_name: string }) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.storage
        .from('file-uploads')
        .download(file.path);

      if (error) throw error;

      // Create a download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "File downloaded",
        description: `${file.file_name} has been downloaded successfully.`
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        variant: "destructive",
        title: "Error downloading file",
        description: "There was an error downloading the file. Please try again."
      });
    }
  };

  const handleFileDelete = async (file: { id: string; path: string }) => {
    if (!currentUser || post.user_id !== currentUser.id) return;

    try {
      const supabase = getSupabase();

      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('file-uploads')
        .remove([file.path]);

      if (storageError) throw storageError;

      // Delete the file attachment record
      const { error: attachmentError } = await supabase
        .from('file_attachments')
        .delete()
        .eq('file_id', file.id);

      if (attachmentError) throw attachmentError;

      // Delete the file record
      const { error: fileError } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id);

      if (fileError) throw fileError;

      toast({
        title: "File deleted",
        description: "The file has been successfully deleted."
      });
      
      onPostUpdate();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        variant: "destructive",
        title: "Error deleting file",
        description: "There was an error deleting the file. Please try again."
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isEditing) {
    return (
      <div className={`${theme.colors.background} p-3 rounded transition-all duration-200`}>
        <div className="flex items-center">
          <strong>{post.user.email}</strong>
        </div>
        <div className="mt-2 flex gap-2">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[100px] p-2 border rounded resize-y bg-white"
            autoFocus
          />
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleEdit}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Press Enter to save, Escape to cancel
        </div>
      </div>
    )
  }

  return (
    <div className={`${theme.colors.background} bg-opacity-80 p-3 rounded group mb-4 hover:scale-[1.01] hover:bg-opacity-100 transition-all duration-200`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className={`font-bold ${theme.colors.foreground}`}>{post.user.email}</div>
          <div className={theme.colors.foreground}>{post.content}</div>
          {post.files && post.files.length > 0 && (
            <div className="mt-2 space-y-2">
              {post.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 bg-white p-2 rounded border group/file max-w-[400px] hover:bg-gray-50 transition-colors"
                >
                  <FileIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{file.file_name}</div>
                    <div className="text-xs text-gray-500">{formatFileSize(file.file_size)}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-500 h-8 w-8 p-0"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 opacity-0 group-hover/file:opacity-100 transition-opacity h-8 w-8 p-0"
                        onClick={() => handleFileDelete(file)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onThreadOpen(post)}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
          >
            <MessageSquare className="h-4 w-4" />
            {threadCount > 0 && <span className="text-xs">{threadCount}</span>}
          </Button>
          {isOwner && (
            <div className="flex gap-1">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
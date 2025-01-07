import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit2, Trash2, X, Check, Download, FileIcon } from 'lucide-react'
import { getCurrentUser, getSupabase } from '../auth'
import { useToast } from "@/components/ui/use-toast"

interface ThreadComment {
  id: string
  user_id: string
  message_id: string
  conversation_id: string
  content: string
  created_at: string
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

interface ConversationThreadCommentItemProps {
  comment: ThreadComment
  onCommentUpdate: () => void
}

export default function ConversationThreadCommentItem({ comment, onCommentUpdate }: ConversationThreadCommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(comment.content)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user))
  }, [])

  const isOwner = currentUser?.id === comment.user_id

  const handleEdit = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('conversation_thread_comments')
        .update({ content: editedContent })
        .eq('id', comment.id)

      if (error) throw error
      
      setIsEditing(false)
      onCommentUpdate()
    } catch (error) {
      console.error('Error updating comment:', error)
    }
  }

  const handleDelete = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('conversation_thread_comments')
        .delete()
        .eq('id', comment.id)

      if (error) throw error
      
      onCommentUpdate()
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedContent(comment.content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    if (!currentUser || comment.user_id !== currentUser.id) return;

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
      
      onCommentUpdate();
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
      <div className="bg-gray-50 p-3 rounded">
        <div className="font-bold">{comment.user.email}</div>
        <div className="mt-2 flex gap-2">
          <Input
            type="text"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleEdit}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Press Enter to save, Escape to cancel
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 p-3 rounded group">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="font-bold">{comment.user.email}</div>
          <div>{comment.content}</div>
          {comment.files && comment.files.length > 0 && (
            <div className="mt-2 space-y-2 max-w-full">
              {comment.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 bg-white p-2 rounded border group/file"
                >
                  <FileIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate max-w-[200px]">{file.file_name}</div>
                    <div className="text-xs text-gray-500">{formatFileSize(file.file_size)}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-500"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 opacity-0 group-hover/file:opacity-100 transition-opacity"
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
        {isOwner && (
          <div className="hidden group-hover:flex gap-1 flex-shrink-0 ml-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-red-500" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 
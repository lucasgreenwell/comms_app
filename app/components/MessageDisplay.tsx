import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Trash2, X, Check, MessageSquare, Download, FileIcon } from 'lucide-react';
import { getCurrentUser, getSupabase } from '../auth';
import { useToast } from "@/components/ui/use-toast";
import { themes } from '../config/themes';
import UserDisplay from './UserDisplay';

interface File {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  path: string;
}

interface User {
  id: string;
  email?: string;
  display_name?: string | null;
}

interface MessageDisplayProps {
  id: string;
  content: string;
  user: User;
  files?: File[];
  currentUser: User | null;
  onlineUsers?: Set<string>;
  messageType: 'post' | 'post_thread' | 'dm' | 'dm_thread';
  threadCount?: number;
  onThreadOpen?: (message: any) => void;
  onUpdate: (content: string) => void;
  tableName: string;
  className?: string;
}

export default function MessageDisplay({
  id,
  content,
  user,
  files,
  currentUser,
  onlineUsers = new Set(),
  messageType,
  threadCount = 0,
  onThreadOpen,
  onUpdate,
  tableName,
  className = ''
}: MessageDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const { toast } = useToast();
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return themes.find(t => t.id === localStorage.getItem('slack-clone-theme')) || themes[0];
    }
    return themes[0];
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const themeId = localStorage.getItem('slack-clone-theme');
      setTheme(themes.find(t => t.id === themeId) || themes[0]);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const isOwner = currentUser?.id === user.id;
  const showThread = ['post', 'dm'].includes(messageType);

  const handleEdit = async () => {
    if (!currentUser) return;
    
    const supabase = getSupabase();
    const { error } = await supabase
      .from(tableName)
      .update({ content: editedContent })
      .eq('id', id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error updating message",
        description: error.message
      });
      return;
    }

    setIsEditing(false);
    onUpdate(editedContent);
    toast({
      title: "Message updated",
      description: "Your message has been successfully updated."
    });
  };

  const handleDelete = async () => {
    if (!currentUser) return;

    const supabase = getSupabase();
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error deleting message",
        description: error.message
      });
      return;
    }

    onUpdate(content);
    toast({
      title: "Message deleted",
      description: "Your message has been successfully deleted."
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleDownload = async (file: File) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.storage
        .from('file-uploads')
        .download(file.path);

      if (error) throw error;

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

  const handleFileDelete = async (file: File) => {
    if (!currentUser || user.id !== currentUser.id) return;

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
      
      onUpdate(content);
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
      <div className={`${theme.colors.background} p-3 rounded transition-all duration-200 ${className}`}>
        <UserDisplay 
          user={user}
          isOnline={onlineUsers.has(user.id)}
          className={`font-bold ${theme.colors.foreground}`}
        />
        <div className="mt-2 flex gap-2">
          <Input
            type="text"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-white"
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
    );
  }

  const isCurrentUser = currentUser?.id === user.id;
  const messageAlignment = messageType === 'dm' 
    ? (isCurrentUser ? 'ml-[50%]' : 'mr-[50%]')
    : '';
  const maxWidth = messageType === 'dm' ? 'max-w-[45%]' : '';

  return (
    <div className={`${theme.colors.background} bg-opacity-80 p-3 rounded group hover:scale-[1.01] hover:bg-opacity-100 transition-all duration-200 ${messageAlignment} ${maxWidth} ${className}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <UserDisplay 
            user={user}
            isOnline={onlineUsers.has(user.id)}
            className={`font-bold ${theme.colors.foreground}`}
          />
          <div className={theme.colors.foreground}>{content}</div>
          {files && files.length > 0 && (
            <div className="mt-2 space-y-2">
              {files.map((file) => (
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
        <div className="flex gap-1">
          {showThread && onThreadOpen && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onThreadOpen({ id, content, user })}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              {threadCount > 0 && <span className="text-xs">{threadCount}</span>}
            </Button>
          )}
          {isOwner && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
} 
import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getSupabase } from '../auth';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Trash2, X, Check, MessageSquare } from 'lucide-react';

interface MessageItemProps {
  message: {
    id: string;
    content: string;
    sender: {
      id: string;
      email: string;
    };
  };
  currentUser: {
    id: string;
  } | null;
  onlineUsers: Set<string>;
  onThreadOpen: (message: {
    id: string;
    content: string;
    sender: {
      email: string;
    };
  }) => void;
}

export default function MessageItem({ message, currentUser, onlineUsers, onThreadOpen }: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const { toast } = useToast();
  const [threadCount, setThreadCount] = useState(0);

  useEffect(() => {
    fetchThreadCount();
  }, []);

  const canEditOrDelete = currentUser && message.sender.id === currentUser.id;

  const fetchThreadCount = async () => {
    try {
      const supabase = getSupabase();
      const { count, error } = await supabase
        .from('conversation_thread_comments')
        .select('id', { count: 'exact' })
        .eq('message_id', message.id);

      if (error) throw error;
      setThreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching thread count:', error);
    }
  };

  const handleEdit = async () => {
    if (!currentUser) return;
    
    const supabase = getSupabase();
    const { error } = await supabase
      .from('messages')
      .update({ content: editedContent })
      .eq('id', message.id)
      .eq('sender_id', currentUser.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error updating message",
        description: error.message
      });
      return;
    }

    setIsEditing(false);
    toast({
      title: "Message updated",
      description: "Your message has been successfully updated."
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleDelete = async () => {
    if (!currentUser) return;

    const supabase = getSupabase();
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', message.id)
      .eq('sender_id', currentUser.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error deleting message",
        description: error.message
      });
      return;
    }

    toast({
      title: "Message deleted",
      description: "Your message has been successfully deleted."
    });
  };

  if (isEditing) {
    return (
      <div className="p-2 rounded bg-gray-100">
        <div className="font-bold flex items-center">
          {message.sender.email}
          {onlineUsers.has(message.sender.id) && (
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
        </div>
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
    );
  }

  return (
    <div className="p-2 rounded bg-gray-100 flex justify-between items-start group">
      <div className="flex-1">
        <p className="font-bold flex items-center">
          {message.sender.email}
          {onlineUsers.has(message.sender.id) && (
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
        </p>
        <p>{message.content}</p>
      </div>
      <div className="hidden group-hover:flex gap-1">
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => onThreadOpen(message)}
          className="flex items-center gap-1"
        >
          <MessageSquare className="h-4 w-4" />
          {threadCount > 0 && <span className="text-xs">{threadCount}</span>}
        </Button>
        {canEditOrDelete && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-red-500" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
} 
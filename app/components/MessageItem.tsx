import { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getSupabase } from '../auth';
import { useToast } from "@/components/ui/use-toast";

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
}

export default function MessageItem({ message, currentUser, onlineUsers }: MessageItemProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [displayContent, setDisplayContent] = useState(message.content);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();

  const canEditOrDelete = currentUser && message.sender.id === currentUser.id;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowOptions(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          setEditedContent(displayContent);
        } else {
          setShowOptions(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isEditing, displayContent]);

  useEffect(() => {
    setDisplayContent(message.content);
    setEditedContent(message.content);
  }, [message.content]);

  const handleEditSubmit = async () => {
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

    setDisplayContent(editedContent);
    setIsEditing(false);
    setShowOptions(false);
    toast({
      title: "Message updated",
      description: "Your message has been successfully updated."
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
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

    setShowOptions(false);
    toast({
      title: "Message deleted",
      description: "Your message has been successfully deleted."
    });
  };

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
        {isEditing ? (
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 p-1 border rounded"
              autoFocus
            />
            <button
              onClick={handleEditSubmit}
              className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedContent(displayContent);
              }}
              className="px-2 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <p>{displayContent}</p>
        )}
      </div>
      {canEditOrDelete && !isEditing && (
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setShowOptions(!showOptions)}
            className="p-1.5 text-xl text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ⋮
          </button>
          {showOptions && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10"
            >
              <button
                onClick={() => {
                  setIsEditing(true);
                  setShowOptions(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 border-b"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 
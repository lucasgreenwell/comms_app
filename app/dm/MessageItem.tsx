import { useState, useEffect } from 'react';
import { getSupabase } from '../auth';
import MessageDisplay from '../components/MessageDisplay';

interface MessageItemProps {
  message: {
    id: string;
    content: string;
    sender: {
      id: string;
      email: string;
      display_name?: string | null;
    };
    files?: {
      id: string;
      file_name: string;
      file_type: string;
      file_size: number;
      path: string;
    }[];
  };
  currentUser: {
    id: string;
    email: string;
    display_name?: string | null;
  } | null;
  onlineUsers: Set<string>;
  onThreadOpen: (message: {
    id: string;
    content: string;
    sender: {
      id: string;
      email: string;
      display_name?: string | null;
    };
  }) => void;
}

export default function MessageItem({ message, currentUser, onlineUsers, onThreadOpen }: MessageItemProps) {
  const [threadCount, setThreadCount] = useState(0);

  useEffect(() => {
    fetchThreadCount();
  }, []);

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

  return (
    <MessageDisplay
      id={message.id}
      content={message.content}
      user={message.sender}
      files={message.files}
      currentUser={currentUser}
      onlineUsers={onlineUsers}
      messageType="dm"
      threadCount={threadCount}
      onThreadOpen={() => onThreadOpen({
        id: message.id,
        content: message.content,
        sender: message.sender
      })}
      onUpdate={fetchThreadCount}
      tableName="messages"
    />
  );
} 
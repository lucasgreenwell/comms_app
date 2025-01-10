import { useState, useEffect } from 'react';
import { getSupabase } from '../auth';
import MessageDisplay from '../components/MessageDisplay';

interface Message {
  id: string;
  content: string;
  created_at: string;
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
  translation: {
    id: string;
    message_id: string | null;
    conversation_thread_comment_id: string | null;
    mandarin_chinese_translation: string | null;
    spanish_translation: string | null;
    english_translation: string | null;
    hindi_translation: string | null;
    arabic_translation: string | null;
    bengali_translation: string | null;
    portuguese_translation: string | null;
    russian_translation: string | null;
    japanese_translation: string | null;
    western_punjabi_translation: string | null;
  } | null;
}

interface MessageItemProps {
  message: Message;
  currentUser: {
    id: string;
    email: string;
    display_name?: string | null;
  } | null;
  onlineUsers: Set<string>;
  onThreadOpen?: (message: any) => void;
}

export default function MessageItem({ message, currentUser, onlineUsers, onThreadOpen }: MessageItemProps) {
  const [translation, setTranslation] = useState(message.translation);

  const handleUpdate = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('translations')
      .select('*')
      .eq('message_id', message.id)
      .single();

    if (!error && data) {
      setTranslation(data);
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
      onThreadOpen={onThreadOpen}
      onUpdate={handleUpdate}
      tableName="messages"
      translation={translation}
      created_at={message.created_at}
    />
  );
} 
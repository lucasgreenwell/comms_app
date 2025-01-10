import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v2 } from '@google-cloud/translate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Initialize Google Translate
if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
  throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set');
}

const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const translate = new v2.Translate({
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
  projectId: serviceAccount.project_id,
});

async function translateText(text: string, targetLanguage: string) {
  try {
    const [translation] = await translate.translate(text, targetLanguage)
    return translation
  } catch (error) {
    console.error('Translation error:', error)
    return null
  }
}

async function createTranslations(
  content: string,
  messageId: string | null = null,
  conversationThreadCommentId: string | null = null,
  targetLanguages: Map<string, string>
) {
  try {
    const translationData: any = {
      created_at: new Date().toISOString()
    };

    // Translate content for each target language and set the appropriate field
    for (const [languageId, languageCode] of targetLanguages) {
      const translation = await translateText(content, languageCode);
      if (!translation) continue;

      switch (languageCode) {
        case 'zh':
          translationData.mandarin_chinese_translation = translation;
          break;
        case 'es':
          translationData.spanish_translation = translation;
          break;
        case 'en':
          translationData.english_translation = translation;
          break;
        case 'hi':
          translationData.hindi_translation = translation;
          break;
        case 'ar':
          translationData.arabic_translation = translation;
          break;
        case 'bn':
          translationData.bengali_translation = translation;
          break;
        case 'pt':
          translationData.portuguese_translation = translation;
          break;
        case 'ru':
          translationData.russian_translation = translation;
          break;
        case 'ja':
          translationData.japanese_translation = translation;
          break;
        case 'pa':
          translationData.western_punjabi_translation = translation;
          break;
        default:
          continue;
      }
    }

    // Set the appropriate ID field
    if (messageId) {
      translationData.message_id = messageId;
    } else if (conversationThreadCommentId) {
      translationData.conversation_thread_comment_id = conversationThreadCommentId;
    }

    const { data, error } = await supabase
      .from('translations')
      .insert([translationData])
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error in createTranslations:', error);
    return null;
  }
}

interface MessageResponse {
  content: string;
  conversation_id: string;
}

interface ThreadCommentResponse {
  content: string;
  message: {
    conversation_id: string;
  };
}

interface ParticipantResponse {
  user: {
    id: string;
    native_language: string | null;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messageId, conversationThreadCommentId, senderId } = body;

    if (!senderId || (!messageId && !conversationThreadCommentId)) {
      console.error('Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the sender's native language
    const { data: sender, error: senderError } = await supabase
      .from('users')
      .select('native_language')
      .eq('id', senderId)
      .single();

    if (senderError) {
      console.error('Error fetching sender language:', senderError);
      throw senderError;
    }

    let content: string;
    let conversationId: string;

    // Get the message content and conversation ID
    if (messageId) {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('content, conversation_id')
        .eq('id', messageId)
        .single() as { data: MessageResponse | null, error: any };

      if (messageError) {
        console.error('Error fetching message:', messageError);
        throw messageError;
      }
      if (!message) {
        console.error('Message not found');
        throw new Error('Message not found');
      }
      
      content = message.content;
      conversationId = message.conversation_id;
    } else {
      const { data: comment, error: commentError } = await supabase
        .from('conversation_thread_comments')
        .select('content, message:message_id(conversation_id)')
        .eq('id', conversationThreadCommentId)
        .single() as { data: ThreadCommentResponse | null, error: any };

      if (commentError) {
        console.error('Error fetching comment:', commentError);
        throw commentError;
      }
      if (!comment) {
        console.error('Comment not found');
        throw new Error('Comment not found');
      }
      
      content = comment.content;
      conversationId = comment.message.conversation_id;
    }

    // Get all participants in the conversation except the sender
    const { data: participants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select(`
        user:user_id (
          id,
          native_language
        )
      `)
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId) as { data: ParticipantResponse[] | null, error: any };

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      throw participantsError;
    }
    if (!participants) {
      console.error('No participants found');
      throw new Error('No participants found');
    }

    // Get unique target languages (excluding sender's language and null values)
    const targetLanguages = new Set(
      participants
        .map(p => p.user.native_language)
        .filter((lang): lang is string => lang !== null && lang !== sender.native_language)
    );

    // Get all language codes at once
    const { data: languagesData, error: languagesError } = await supabase
      .from('top_languages')
      .select('id, code')
      .in('id', Array.from(targetLanguages));

    if (languagesError) {
      console.error('Error fetching language codes:', languagesError);
      throw languagesError;
    }

    if (!languagesData) {
      console.error('No language codes found for:', Array.from(targetLanguages));
      throw new Error('No language codes found');
    }

    // Create a map of language IDs to codes for easy lookup
    const languageCodeMap = new Map(
      languagesData.map(lang => [lang.id, lang.code])
    );

    // Create a single translation entry with all languages
    const translation = await createTranslations(
      content,
      messageId,
      conversationThreadCommentId,
      languageCodeMap
    );

    return NextResponse.json(translation, { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in translation endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
} 
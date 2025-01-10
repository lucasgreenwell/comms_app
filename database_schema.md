# Database Schema Documentation

## Tables

### 1. **users**
| Column           | Type  | Description                                                             |
|------------------|-------|-------------------------------------------------------------------------|
| **id**           | UUID  | Primary key (potentially references or is linked to `auth.users.id`)    |
| **email**        | TEXT  | User’s email address                                                    |
| **display_name** | TEXT  | Display name shown to other users                                       |
| **native_language** | UUID | FK to a language reference (possibly `top_languages.id`), if applicable |

**Notes**:  
- This table may be used to store user-specific data beyond the core authentication details, or it may be a companion to `auth.users`.  
- The `native_language` column likely relates to a row in `top_languages` or another language reference table.

---

### 2. **user_profiles**
| Column              | Type | Description                                                               |
|---------------------|------|---------------------------------------------------------------------------|
| **id**              | UUID | Primary key, likely references `auth.users.id` or `users.id`              |
| **profile_pic_url** | TEXT | URL to user’s profile picture                                             |

**Notes**:  
- This table stores profile-related data (e.g., avatar) separate from the core `users` or `auth.users` table.

---

### 3. **channels**
| Column       | Type        | Description                                     |
|--------------|------------|-------------------------------------------------|
| **id**       | UUID       | Primary key                                     |
| **created_at** | TIMESTAMPTZ | Timestamp of channel creation (UTC)           |
| **name**     | TEXT       | Channel name (could be unique)                  |

**Notes**:  
- Channels are used for grouping messages/posts (similar to chat rooms).  
- `created_at` is often automatically set to `NOW()` in Postgres.

---

### 4. **channel_members**
| Column      | Type        | Description                                                          |
|-------------|------------|----------------------------------------------------------------------|
| **id**      | UUID       | Primary key                                                          |
| **user_id** | UUID       | FK to `users.id` (or `auth.users.id`) indicating which user joined   |
| **channel_id** | UUID    | FK to `channels.id`                                                  |
| **created_at** | TIMESTAMPTZ | Timestamp when user joined this channel                           |

**Notes**:  
- Manages the many-to-many relationship between users and channels.

---

### 5. **posts**
| Column       | Type        | Description                                      |
|-------------|------------|--------------------------------------------------|
| **id**       | UUID       | Primary key                                      |
| **created_at** | TIMESTAMPTZ | Timestamp of post creation (UTC)               |
| **content**  | TEXT       | Post’s textual content                           |
| **user_id**  | UUID       | FK to `users.id` (who created the post)          |
| **channel_id** | UUID     | FK to `channels.id` (which channel the post is in)|

**Notes**:  
- Used for storing posts within channels (like forum threads or chat posts).

---

### 6. **post_thread_comments**
| Column       | Type        | Description                                                             |
|-------------|------------|-------------------------------------------------------------------------|
| **id**       | UUID       | Primary key                                                             |
| **post_id**  | UUID       | FK to `posts.id`                                                        |
| **user_id**  | UUID       | FK to `users.id` (the commenter)                                        |
| **content**  | TEXT       | Comment text                                                            |
| **created_at** | TIMESTAMPTZ | Timestamp of comment creation                                         |

**Notes**:  
- Allows for threaded comments on a specific post.

---

### 7. **messages**
| Column             | Type        | Description                                                                 |
|--------------------|------------|-----------------------------------------------------------------------------|
| **id**             | UUID       | Primary key                                                                 |
| **conversation_id**| UUID       | FK to `conversations.id` (which conversation this message belongs to)       |
| **sender_id**      | UUID       | FK to `users.id` (who sent the message)                                     |
| **content**        | TEXT       | Message text                                                                |
| **created_at**     | TIMESTAMPTZ | Timestamp of message creation                                               |

**Notes**:  
- Stores messages within a direct or group conversation.  
- Threading within messages may be handled by separate comments tables (`conversation_thread_comments`).

---

### 8. **presence**
| Column       | Type         | Description                                  |
|-------------|-------------|----------------------------------------------|
| **user_id**  | UUID        | FK to `users.id` (which user)                |
| **is_online**| BOOLEAN     | Whether the user is currently online         |
| **last_seen**| TIMESTAMPTZ | Timestamp of last activity or sign-off       |

**Notes**:  
- Tracks the real-time online/offline status of each user.

---

### 9. **top_languages**
| Column   | Type | Description                                              |
|----------|------|----------------------------------------------------------|
| **id**   | UUID | Primary key                                              |
| **language** | TEXT | Human-readable language name (e.g. “English”, “Spanish”) |
| **code** | TEXT | Language code (e.g., “en”, “es”)                         |

**Notes**:  
- May be used to populate user language preferences or references.

---

### 10. **translations**
| Column                              | Type        | Description                                                           |
|-------------------------------------|------------|-----------------------------------------------------------------------|
| **id**                              | UUID       | Primary key                                                           |
| **message_id**                      | UUID       | FK to `messages.id` (nullable)                                        |
| **post_id**                         | UUID       | FK to `posts.id` (nullable)                                           |
| **conversation_thread_comment_id**  | UUID       | FK to `conversation_thread_comments.id` (nullable)                    |
| **post_thread_comment_id**          | UUID       | FK to `post_thread_comments.id` (nullable)                            |
| **user_id**                         | UUID       | Possibly the owner or creator of these translations (nullable)        |
| **created_at**                      | TIMESTAMPTZ | Timestamp when the translation was created                            |
| **mandarin_chinese_translation**    | TEXT       | Translation text                                                      |
| **spanish_translation**            | TEXT       | Translation text                                                      |
| **english_translation**            | TEXT       | Translation text                                                      |
| **hindi_translation**              | TEXT       | Translation text                                                      |
| **arabic_translation**             | TEXT       | Translation text                                                      |
| **bengali_translation**            | TEXT       | Translation text                                                      |
| **portuguese_translation**         | TEXT       | Translation text                                                      |
| **russian_translation**            | TEXT       | Translation text                                                      |
| **japanese_translation**           | TEXT       | Translation text                                                      |
| **western_punjabi_translation**    | TEXT       | Translation text                                                      |

**Notes**:  
- Centralizes multilingual translations for posts, messages, or comments.  
- Only one of `message_id`, `post_id`, etc. might be used per row, depending on what content is being translated.

---

### 11. **conversations**
| Column       | Type        | Description                                                                   |
|-------------|------------|-------------------------------------------------------------------------------|
| **id**       | UUID       | Primary key                                                                   |
| **name**     | TEXT       | Conversation name (for group chats, etc.)                                     |
| **type**     | TEXT       | Could indicate “direct”, “group”, “channel-based”, etc.                       |
| **created_at** | TIMESTAMPTZ | Timestamp when the conversation was created                                 |

**Notes**:  
- Used to group messages together.  
- For direct messages, `type` could be “DM,” and for group, “GROUP,” etc.

---

### 12. **conversation_participants**
| Column             | Type        | Description                                                         |
|--------------------|------------|---------------------------------------------------------------------|
| **conversation_id**| UUID       | FK to `conversations.id`                                            |
| **user_id**        | UUID       | FK to `users.id`                                                    |
| **created_at**     | TIMESTAMPTZ | Timestamp when user joined or was added to the conversation         |

**Notes**:  
- Tracks which users are in which conversation.  
- Often used for direct messages (2 participants) or group chats (multiple participants).

---

### 13. **conversation_participant_keys**
| Column              | Type        | Description                                                |
|---------------------|------------|------------------------------------------------------------|
| **id**             | INT4       | Primary key (integer sequence)                             |
| **participant_key**| TEXT       | Possibly an encryption or identity key for the participant |
| **conversation_id**| UUID       | FK to `conversations.id`                                   |
| **created_at**     | TIMESTAMPTZ | Timestamp of creation                                     |

**Notes**:  
- Could be used to manage additional security keys or tokens for participants in a conversation.

---

### 14. **conversation_thread_comments**
| Column                | Type        | Description                                                         |
|-----------------------|------------|---------------------------------------------------------------------|
| **id**                | UUID       | Primary key                                                         |
| **conversation_id**   | UUID       | FK to `conversations.id`                                            |
| **user_id**           | UUID       | FK to `users.id` (the commenter)                                    |
| **content**           | TEXT       | Comment text                                                        |
| **created_at**        | TIMESTAMPTZ | Timestamp of comment creation                                       |
| **message_id**        | UUID       | FK to `messages.id` (if tied to a specific message)                 |

**Notes**:  
- Allows for threaded replies to messages inside a conversation.

---

### 15. **file_attachments**
| Column                             | Type        | Description                                                            |
|------------------------------------|------------|------------------------------------------------------------------------|
| **id**                             | UUID       | Primary key                                                            |
| **file_id**                        | UUID       | FK to `files.id` (the actual file resource)                            |
| **message_id**                     | UUID       | FK to `messages.id`                                                    |
| **post_id**                        | UUID       | FK to `posts.id`                                                       |
| **conversation_thread_comment_id** | UUID       | FK to `conversation_thread_comments.id`                                 |
| **post_thread_comment_id**         | UUID       | FK to `post_thread_comments.id`                                        |
| **created_at**                     | TIMESTAMPTZ | Timestamp of attachment creation                                       |

**Notes**:  
- Associates a file with one of several possible content items (message, post, or comment).

---

### 16. **files**
| Column       | Type        | Description                                           |
|-------------|------------|-------------------------------------------------------|
| **id**       | UUID       | Primary key                                           |
| **file_name**| TEXT       | Original file name                                    |
| **file_type**| TEXT       | MIME type or general file type                        |
| **file_size**| INT8       | File size in bytes                                    |
| **bucket**   | TEXT       | Storage bucket or location identifier                 |
| **path**     | TEXT       | File path or key in the bucket                        |
| **uploaded_by**| UUID     | FK to `users.id` (who uploaded the file)              |
| **created_at**| TIMESTAMPTZ | Timestamp of file upload                            |

**Notes**:  
- Manages metadata for uploaded files.

---

### 17. **emoji_reactions**
| Column                             | Type        | Description                                                    |
|------------------------------------|------------|----------------------------------------------------------------|
| **id**                             | UUID       | Primary key                                                    |
| **message_id**                     | UUID       | FK to `messages.id`                                            |
| **post_id**                        | UUID       | FK to `posts.id`                                               |
| **conversation_thread_comment_id** | UUID       | FK to `conversation_thread_comments.id`                        |
| **post_thread_comment_id**         | UUID       | FK to `post_thread_comments.id`                                |
| **created_at**                     | TIMESTAMPTZ | Timestamp of reaction creation                                 |
| **user_id**                        | UUID       | FK to `users.id` (who reacted)                                 |
| **emoji**                          | TEXT       | The emoji or reaction code                                     |

**Notes**:  
- Allows users to react to messages, posts, or thread comments with emojis.

---

## Notes
- Most `id` columns are `UUID` primary keys.  
- The `created_at` columns are generally `timestamptz` (UTC timestamps).  
- Many tables include user references (likely `users.id` or possibly `auth.users.id`).  
- Relationship tables (e.g., **channel_members**, **conversation_participants**) handle many-to-many links.  
- Some tables (like **translations**, **file_attachments**, **emoji_reactions**) can reference multiple content tables by including columns such as `message_id`, `post_id`, or `comment_id`. Usually only one of those columns is used per record.

## Authentication
- The `users` table may be linked to the authentication system via `auth.users.id`.  
- A separate **user_profiles** table extends user data with profile pictures or other info.

## Data Types
- **UUID**: Universally Unique Identifier  
- **TEXT**: Variable-length character strings  
- **BOOLEAN**: True/false values  
- **INT4** / **INT8**: 4-byte or 8-byte integers (e.g., for IDs or file sizes)  
- **TIMESTAMPTZ**: Timestamp with time zone (commonly used for tracking creation/updated times)

## Relationships (High-Level)
1. **Users** can have multiple **posts**, **messages**, **emoji_reactions**, etc.  
2. **Channels** have many **posts**; users join channels via **channel_members**.  
3. **Conversations** track multiple **messages**; users join conversations via **conversation_participants**.  
4. **Thread Comments** exist for both **posts** and **messages** (via `post_thread_comments` and `conversation_thread_comments`).  
5. **Translations**, **file_attachments**, and **emoji_reactions** can reference any of the post/message/comment tables.  

---

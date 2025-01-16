# Database Schema Documentation (Updated)

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
| Column       | Type        | Description                                                         |
|--------------|------------|---------------------------------------------------------------------|
| **id**       | UUID       | Primary key                                                         |
| **user_id**  | UUID       | FK to `users.id` (or `auth.users.id`) indicating which user joined  |
| **channel_id** | UUID     | FK to `channels.id`                                                 |
| **created_at** | TIMESTAMPTZ | Timestamp when user joined this channel                           |

**Notes**:  
- Manages the many-to-many relationship between users and channels.

---

### 5. **posts**
| Column       | Type        | Description                                      |
|--------------|------------|--------------------------------------------------|
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
|--------------|------------|-------------------------------------------------------------------------|
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

### 8. **vector_embeddings**
| Column                             | Type         | Description                                                             |
|------------------------------------|--------------|-------------------------------------------------------------------------|
| **id**                             | UUID         | Primary key                                                             |
| **message_id**                     | UUID         | FK to `messages.id`, nullable                                           |
| **post_id**                        | UUID         | FK to `posts.id`, nullable                                              |
| **conversation_thread_comment_id** | UUID         | FK to `conversation_thread_comments.id`, nullable                       |
| **post_thread_comment_id**         | UUID         | FK to `post_thread_comments.id`, nullable                               |
| **created_at**                     | TIMESTAMP    | Default to `NOW()`, record creation time                                |
| **embedding**                      | vector(3072) | Vector field with 3072 dimensions                                       |

**Notes**:  
- Handles embeddings for various content types (messages, posts, comments).  
- Includes Row-Level Security (RLS) policies for authenticated access.  

**RLS Policies**:  
```sql
ALTER TABLE vector_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY read_policy ON vector_embeddings
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY insert_policy ON vector_embeddings
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY update_policy ON vector_embeddings
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY delete_policy ON vector_embeddings
    FOR DELETE
    USING (auth.role() = 'authenticated');

```

---

### 9. **tts_recordings**
| Column                             | Type         | Description                                                             |
|------------------------------------|--------------|-------------------------------------------------------------------------|
| **id**                             | UUID         | Primary key                                                             |
| **post_id**                        | UUID         | FK to `posts.id`, nullable                                              |
| **message_id**                     | UUID         | FK to `messages.id`, nullable                                           |
| **post_thread_comment_id**         | UUID         | FK to `post_thread_comments.id`, nullable                               |
| **conversation_thread_comment_id** | UUID         | FK to `conversation_thread_comments.id`, nullable                       |
| **storage_path**                   | TEXT         | Path to the audio file in Supabase storage                              |
| **created_at**                     | TIMESTAMPTZ  | Default to `NOW()`, record creation time                                |
| **updated_at**                     | TIMESTAMPTZ  | Default to `NOW()`, last update time                                    |
| **status**                         | TEXT         | Status of TTS processing ('pending', 'processing', 'completed', 'failed')|
| **error_message**                  | TEXT         | Error message if processing failed, nullable                            |

**Notes**:  
- Only one of the foreign key columns (`post_id`, `message_id`, `post_thread_comment_id`, `conversation_thread_comment_id`) can be set at a time.
- Includes a storage bucket `tts_recordings` for storing the audio files.
- Status field tracks the processing state of each TTS request.

**RLS Policies**:  
```sql
ALTER TABLE tts_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read tts_recordings"
ON tts_recordings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert tts_recordings"
ON tts_recordings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update their own tts_recordings"
ON tts_recordings FOR UPDATE
TO authenticated
USING (true);
```

**Storage Policies**:
```sql
CREATE POLICY "Allow authenticated users to read tts recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'tts_recordings');

CREATE POLICY "Allow authenticated users to insert tts recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tts_recordings');
# Profile Directory Documentation

## Overview
The profile directory contains components and functionality for managing user profiles in the Slack clone application. It handles user settings like display names, profile pictures, theme preferences, and language settings. The profile page provides a centralized location for users to customize their experience and manage their identity within the application.

## Directory Structure
```
app/profile/
├── page.tsx              # Main profile settings page component
```

## User Interaction Flows

### Profile Picture Upload Flow
1. User selects an image file through the UI
2. Frontend:
   - Validates file is an image type
   - Shows upload progress state
3. Backend Process:
   - Uploads file to Supabase storage bucket 'profile-pics'
   - Generates public URL for the image
   - Updates `user_profiles` table with new URL
4. UI Updates:
   - Shows new profile picture immediately
   - Displays success/error toast notification

### Display Name Update Flow
1. User enters new display name
2. Frontend submits update
3. Backend Process:
   - Updates `users` table with new display name
4. UI Updates:
   - Refreshes user data
   - Shows success/error toast notification

### Language Preference Update Flow
1. User selects language from dropdown
2. Frontend submits update
3. Backend Process:
   - Updates `users` table with new native language
4. UI Updates:
   - Updates language selection state
   - Shows success/error toast notification

### Theme Selection Flow
1. User selects theme from radio options
2. Frontend:
   - Saves theme to localStorage
   - Reloads page to apply theme
3. Theme persists across sessions

## TypeScript Types

### ExtendedUser Interface
```typescript
interface ExtendedUser extends User {
  display_name?: string | null;
  native_language?: string | null;
}
```

### Language Interface
```typescript
interface Language {
  id: string;
  language: string;
}
```

## UI Components

### ProfilePage Component
Main component for profile settings management.

#### State Management
```typescript
const [user, setUser] = useState<ExtendedUser | null>(null)
const [selectedTheme, setSelectedTheme] = useState<string>()
const [displayName, setDisplayName] = useState<string>('')
const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)
const [uploading, setUploading] = useState(false)
const [languages, setLanguages] = useState<Language[]>([])
const [selectedLanguage, setSelectedLanguage] = useState<string>('')
```

#### Key Functions
1. `fetchUser()`
   - Retrieves user data from Supabase
   - Fetches profile picture URL
   - Sets initial state values

2. `handleProfilePicUpload()`
   - Manages file upload to Supabase storage
   - Updates profile picture URL in database

3. `handleDisplayNameChange()`
   - Updates user's display name in database

4. `handleLanguageChange()`
   - Updates user's language preference

5. `handleThemeChange()`
   - Updates theme preference in localStorage
   - Triggers page reload to apply theme

### UI Components Used
- Avatar (from @/components/ui/avatar)
- Button (from @/components/ui/button)
- Card (from @/components/ui/card)
- Input (from @/components/ui/input)
- RadioGroup (from @/components/ui/radio-group)
- Select (from @/components/ui/select)

## Database Schema

### users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    native_language UUID REFERENCES top_languages(id)
);
```

### user_profiles Table
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY,
    profile_pic_url TEXT
);
```

### top_languages Table
```sql
CREATE TABLE top_languages (
    id UUID PRIMARY KEY,
    language TEXT,
    code TEXT
);
```

## Realtime Features
The profile page does not currently implement any Supabase real-time subscriptions.

## API Request/Response Formats

### Fetch User Data
```typescript
// Direct Supabase Query
const { data: userData, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single()

// Response Format
{
  id: string;
  email: string;
  display_name: string | null;
  native_language: string | null;
}
```

### Update Display Name
```typescript
// Direct Supabase Query
const { error } = await supabase
  .from('users')
  .update({ display_name: string })
  .eq('id', userId)
```

### Update Language Preference
```typescript
// Direct Supabase Query
const { error } = await supabase
  .from('users')
  .update({ native_language: string })
  .eq('id', userId)
```

### Upload Profile Picture
```typescript
// Storage Upload
const { error: uploadError } = await supabase.storage
  .from('profile-pics')
  .upload(filePath, file)

// Profile Update
const { error: updateError } = await supabase
  .from('user_profiles')
  .upsert({
    id: userId,
    profile_pic_url: string
  })
```

### Fetch Languages
```typescript
// Direct Supabase Query
const { data, error } = await supabase
  .from('top_languages')
  .select('*')
  .order('language')

// Response Format
Array<{
  id: string;
  language: string;
  code: string;
}>
``` 
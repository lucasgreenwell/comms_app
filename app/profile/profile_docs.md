# Profile Directory Documentation

## Overview
The profile directory contains components and functionality for managing user profiles and authentication in the Slack clone application. It handles user registration, login, profile settings like display names, profile pictures, theme preferences, and language settings. The profile section provides a centralized location for users to manage their identity and customize their experience within the application.

## Directory Structure
```
app/profile/
├── page.tsx              # Main profile settings page component
├── login/
│   └── page.tsx         # User login page component
└── signup/
    └── page.tsx         # User registration page component
```

## Types

### User Types
```typescript
interface ExtendedUser extends User {
  display_name?: string | null
  native_language?: string | null
}

interface Language {
  id: string
  language: string
}

interface AuthError {
  message: string
}
```

## User Interaction Flows

### Authentication Flow
1. User Registration (Signup)
   - User enters email and password
   - Frontend submits to Supabase Auth
   - Confirmation email is sent
   - User is redirected to login page
2. Login
   - User enters credentials
   - Frontend authenticates with Supabase
   - Session is created and stored
   - User is redirected to main application
3. Email Confirmation
   - User clicks confirmation link
   - Email is verified
   - User can now log in
4. Password Reset
   - User requests password reset
   - Reset email is sent
   - User sets new password

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

## Components

### LoginPage Component (`login.tsx`)

#### Purpose
Handles user authentication and login functionality.

#### Key Features
- Email/password authentication
- Error handling and display
- Loading states
- Email confirmation handling
- Navigation to signup

#### Key Functions
1. `handleLogin()`
   - Manages login process with Supabase
   - Handles authentication errors
   - Updates session state

2. `handleResendConfirmation()`
   - Resends confirmation email
   - Handles error states
   - Shows success/error notifications

### SignupPage Component (`signup.tsx`)

#### Purpose
Manages new user registration process.

#### Key Features
- User registration form
- Input validation
- Error handling
- Success notifications
- Redirect to login

#### Key Functions
1. `handleSignup()`
   - Creates new user account
   - Triggers confirmation email
   - Handles registration errors
   - Redirects to login page

### ProfilePage Component (`page.tsx`)
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

## Database Schema

### users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    native_language UUID REFERENCES top_languages(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_sign_in_at TIMESTAMPTZ
);
```

### user_profiles Table
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES users(id),
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

## API Request/Response Formats

### Authentication Operations

#### Sign Up
```typescript
const { data, error } = await supabase.auth.signUp({
  email: string,
  password: string
})

// Response
{
  data: {
    user: User | null,
    session: Session | null
  },
  error: AuthError | null
}
```

#### Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: string,
  password: string
})

// Response
{
  data: {
    user: User | null,
    session: Session | null
  },
  error: AuthError | null
}
```

#### Resend Confirmation
```typescript
const { error } = await supabase.auth.resend({
  type: 'signup',
  email: string
})
```

### Profile Operations

#### Fetch User Data
```typescript
const { data: userData, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId)
  .single()

// Response Format
{
  id: string
  email: string
  display_name: string | null
  native_language: string | null
}
```

#### Update Display Name
```typescript
const { error } = await supabase
  .from('users')
  .update({ display_name: string })
  .eq('id', userId)
```

#### Update Language Preference
```typescript
const { error } = await supabase
  .from('users')
  .update({ native_language: string })
  .eq('id', userId)
```

#### Upload Profile Picture
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

#### Fetch Languages
```typescript
const { data, error } = await supabase
  .from('top_languages')
  .select('*')
  .order('language')

// Response Format
Array<{
  id: string
  language: string
  code: string
}>
```

## Error Handling

The application implements comprehensive error handling for:
- Authentication failures
- Email confirmation issues
- Profile update errors
- File upload errors
- Network issues
- Invalid input validation

Each error is caught and displayed to the user via toast notifications with appropriate error messages and, where applicable, action buttons (like resend confirmation email). 
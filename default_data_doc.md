# Default Data Setup Script Documentation

## Overview
This script is responsible for setting up initial test data in the Supabase database. It uses the Supabase Admin API to create resources and populate tables.

## Functionality
1. Creates three test users with the following details:
   - Email: fullstackhuman47+1@gmail.com
     - Display Name: radiologist
     - Profile Picture: radiologist profile image
   - Email: fullstackhuman47+2@gmail.com
     - Display Name: ai-expert
     - Profile Picture: AI profile image
   - Email: fullstackhuman47+3@gmail.com
     - Display Name: gauntlet-expert
     - Profile Picture: gauntlet profile image

2. For each user, the script:
   - Uploads their profile picture to Supabase storage in the 'profile-pics' bucket
   - Creates a user account with email confirmation enabled
   - Creates a user profile with the uploaded profile picture URL
   - Sets their display name in the public.users table

3. Creates initial content:
   - Reads radiology reports from rad_reports.json
   - Posts each report in the radiology channel (ID: 371ab9c4-1e57-4b54-a60b-65ee86f413fd)
   - All reports are posted by the radiologist user

## Technical Details
- Uses Supabase Service Role Key for admin access
- Handles file uploads for profile pictures
- Manages user creation and profile setup
- Creates posts in the specified channel
- Sets up user display names for chat interface

## Dependencies
- Requires .env.local with Supabase credentials
- Needs access to profile picture assets
- Needs access to rad_reports.json for report data
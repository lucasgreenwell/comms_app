/**
 * create-users.js
 * 
 * Script to create multiple users in Supabase using the Admin API.
 * 
 * Usage:
 *   node create-users.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Grab values from your .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a "service role" supabase client
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const users = [
  {
    email: 'fullstackhuman47+1@gmail.com',
    profilePic: 'radilogist_profile.jpeg',
    localPath: 'assets/radilogist_profile.jpeg'
  },
  {
    email: 'fullstackhuman47+2@gmail.com',
    profilePic: 'ai_profile.jpeg',
    localPath: 'assets/ai_profile.jpeg'
  },
  {
    email: 'fullstackhuman47+3@gmail.com',
    profilePic: 'gaunltet_profile.png',
    localPath: 'assets/gaunltet_profile.png'
  }
];

async function uploadProfilePic(filePath, fileName) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const { data, error } = await supabaseAdmin.storage
      .from('profile-pics')
      .upload(fileName, fileBuffer, {
        contentType: path.extname(fileName) === '.png' ? 'image/png' : 'image/jpeg',
        upsert: true
      });

    if (error) throw error;

    const { data: urlData } = supabaseAdmin.storage
      .from('profile-pics')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`Error uploading profile pic ${fileName}:`, error);
    throw error;
  }
}

async function main() {
  for (const user of users) {
    try {
      // First upload the profile picture
      const publicUrl = await uploadProfilePic(user.localPath, user.profilePic);
      
      // Create the user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: 'password', // or pick your own
        email_confirm: true,  // set to true so the user is "confirmed"
      });

      if (error) {
        console.error(`\n❌ Error creating user ${user.email}:\n`, error);
        continue;
      }

      // Add profile photo
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: data.user.id,
          profile_pic_url: publicUrl
        });

      if (profileError) {
        console.error(`\n❌ Error adding profile for user ${user.email}:\n`, profileError);
      } else {
        console.log(`\n✅ Created user: ${data.user.email} (ID: ${data.user.id}) with profile photo`);
      }
    } catch (err) {
      console.error(`\n❌ Error processing user ${user.email}:\n`, err);
    }
  }
}

main()
  .then(() => {
    console.log('\nAll done!\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nScript error:\n', err);
    process.exit(1);
  });

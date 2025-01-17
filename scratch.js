import { ElevenLabsClient } from "elevenlabs";
import * as dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY
});

async function deleteVoices() {
    try {
        // Read the voices from the JSON file
        const voicesData = JSON.parse(fs.readFileSync('elevenlabs_voices.json', 'utf8'));
        
        // Filter voices to delete (case-insensitive matching)
        const voicesToDelete = voicesData.voices.filter(voice => {
            const name = voice.name.toLowerCase();
            return name === 'autumn' || name === 'lucas' || name === 'test-voice';
        });

        console.log(`Found ${voicesToDelete.length} voices to delete`);

        // Delete each voice
        for (const voice of voicesToDelete) {
            try {
                console.log(`Deleting voice: ${voice.name} (${voice.voice_id})`);
                await client.voices.delete(voice.voice_id);
                console.log(`Successfully deleted voice: ${voice.name}`);
            } catch (error) {
                console.error(`Error deleting voice ${voice.name}: ${error.message}`);
            }
        }

        console.log('Voice deletion process completed');
    } catch (error) {
        console.error('Error in deleteVoices:', error);
    }
}

// Run the function
deleteVoices();

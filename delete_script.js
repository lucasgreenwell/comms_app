import { ElevenLabsClient } from "elevenlabs";
import * as dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY
});

async function deleteVoice(voiceId) {
    try {
        await client.voices.delete(voiceId);
        console.log(`Successfully deleted voice with ID: ${voiceId}`);
    } catch (error) {
        console.error('Error in deleteVoice:', error);
    }
}

// Get voice ID from command line arguments
const voiceId = process.argv[2];

if (!voiceId) {
    console.error('Please provide a voice ID as a command line argument');
    process.exit(1);
}

// Run the function with the provided voice ID
deleteVoice(voiceId);
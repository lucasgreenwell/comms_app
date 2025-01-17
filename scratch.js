import { ElevenLabsClient } from "elevenlabs";
import * as dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY
});

async function getAllVoices() {
    try {
        console.log('Retrieving all voices from ElevenLabs...');
        const response = await client.voices.getAll();
        
        // Filter voices to only include generated or cloned ones
        const filteredVoices = {
            voices: response.voices.filter(voice => 
                voice.category === 'generated' || voice.category === 'cloned'
            )
        };
        
        // Save filtered voices to a JSON file
        fs.writeFileSync('elevenlabs_voices.json', JSON.stringify(filteredVoices, null, 2));
        
        console.log('Voices saved successfully to elevenlabs_voices.json');
        console.log(`Total voices retrieved: ${filteredVoices.voices.length}`);
        console.log('Categories included: generated, cloned');
        return filteredVoices;
    } catch (error) {
        console.error('Error retrieving voices:', error);
    }
}

// Run the function
getAllVoices();

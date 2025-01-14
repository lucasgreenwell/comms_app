/// <reference lib="deno.ns" />
import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

console.log('Initializing Supabase client...');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchPostsWithoutEmbeddings() {
  console.log('Fetching posts without embeddings using RPC...');
  const { data, error } = await supabase.rpc('posts_without_embeddings');
  if (error) {
    console.error('Error in RPC call:', error);
    throw error;
  }
  console.log(`Fetched ${data.length} post(s) without embeddings.`);
  return data;
}

async function generateEmbedding(text: string) {
  console.log('Calling OpenAI API to generate embedding...');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-large'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('OpenAI API responded with an error:', errText);
    throw new Error(`OpenAI API error: ${errText}`);
  }

  const result = await response.json();
  const embedding = result.data[0].embedding;
  console.log('Received embedding from OpenAI API.');
  return embedding;
}

async function saveEmbedding(post_id: string, embedding: number[]) {
  console.log(`Saving embedding for post_id: ${post_id}...`);
  const { error } = await supabase
    .from('vector_embeddings')
    .insert([{ 
      id: crypto.randomUUID(),
      post_id, 
      embedding,
      created_at: new Date().toISOString()
    }]);
  if (error) {
    console.error('Error saving embedding to database:', error);
    throw error;
  }
  console.log(`Successfully saved embedding for post_id: ${post_id}.`);
}

Deno.serve(async (req: Request) => {
  console.log('Edge function invoked.');
  try {
    const posts = await fetchPostsWithoutEmbeddings();

    for (const post of posts) {
      console.log(`Processing post_id: ${post.id}`);
      const { id: post_id, content } = post;
      if (!content) {
        console.warn(`Post id ${post_id} has no content. Skipping.`);
        continue;
      }
      const embedding = await generateEmbedding(content);
      await saveEmbedding(post_id, embedding);
    }

    console.log('All posts processed successfully.');
    return new Response(
      JSON.stringify({ message: 'Processed missing embeddings' }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error processing embeddings:', error);
    return new Response(
      JSON.stringify({ error: 'Error processing embeddings' }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});

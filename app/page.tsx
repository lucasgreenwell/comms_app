import { getSupabase } from './auth'

export default async function Home() {
  const supabase = getSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Slack Clone</h1>
      <p>Select a channel from the sidebar to start chatting!</p>
    </div>
  )
}


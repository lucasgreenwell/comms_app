'use client'

import { useState } from 'react'
import { getSupabase } from '../auth'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      alert('Signed up successfully! Check your email for confirmation.')
    } catch (error) {
      setError(error.message)
    }
  }

  return (
    <form onSubmit={handleSignUp}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Sign Up</button>
      {error && <p className="text-red-500">{error}</p>}
    </form>
  )
}


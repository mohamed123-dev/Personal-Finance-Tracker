import React, { useState } from 'react'
import axios from 'axios'

export type User = { id: number; email: string }

export const Auth: React.FC<{ onAuthed: (token: string, user: User) => void }>= ({ onAuthed }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const res = await axios.post(url, { email, password })
      onAuthed(res.data.token, res.data.user)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed')
    }
  }

  const input = { padding: 10, border: '1px solid #ddd', borderRadius: 8, width: '100%' }

  return (
    <div style={{ maxWidth: 360, margin: '64px auto' }}>
      <h2 style={{ textAlign: 'center' }}>{mode === 'login' ? 'Login' : 'Sign Up'}</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={input} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={input} />
        {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
        <button type="submit" style={{ ...input, cursor: 'pointer', background: '#2563eb', color: '#fff' }}>
          {mode === 'login' ? 'Login' : 'Create account'}
        </button>
      </form>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer' }}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Login'}
        </button>
      </div>
    </div>
  )
}

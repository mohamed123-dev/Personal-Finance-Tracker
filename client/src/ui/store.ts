export type AuthState = { token: string | null; user: { id: number; email: string } | null }

const listeners = new Set<() => void>()
const state: AuthState = { token: null, user: null }

export function setAuth(token: string, user: { id: number; email: string }) {
  state.token = token
  state.user = user
  localStorage.setItem('auth', JSON.stringify(state))
  listeners.forEach(l => l())
}

export function clearAuth() {
  state.token = null
  state.user = null
  localStorage.removeItem('auth')
  listeners.forEach(l => l())
}

export function getAuth(): AuthState {
  if (!state.token) {
    const raw = localStorage.getItem('auth')
    if (raw) {
      try { const parsed = JSON.parse(raw); state.token = parsed.token; state.user = parsed.user } catch {}
    }
  }
  return state
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001'

interface User {
  id: string
  email: string
  full_name: string
  plan: string
  is_verified: boolean
}

interface AuthCtx {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('invex_token')
  )
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) { setIsLoading(false); return }
    fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((u: User) => { setUser(u); setIsLoading(false) })
      .catch(() => {
        localStorage.removeItem('invex_token')
        setToken(null)
        setIsLoading(false)
      })
  }, [token])

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password })
    const r = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    if (!r.ok) throw new Error('Invalid credentials')
    const data = await r.json()
    localStorage.setItem('invex_token', data.access_token)
    setToken(data.access_token)
  }

  const logout = () => {
    localStorage.removeItem('invex_token')
    localStorage.removeItem('invex_analysis_tab')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

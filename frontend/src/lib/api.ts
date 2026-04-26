const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export function getToken(): string | null {
  return localStorage.getItem('invex_token')
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers as Record<string, string> || {}),
    },
  })
  if (response.status === 401) {
    localStorage.removeItem('invex_token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  return response
}

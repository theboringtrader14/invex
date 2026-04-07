import axios from 'axios'

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/v1`
const STAAX_API = `${import.meta.env.VITE_STAAX_API_URL || 'http://localhost:8000'}/api/v1`

// Auth still used for SIPs/IPO/Watchlist (write endpoints — kept for future)
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('staax_token')}` } })

// Auth — shared with STAAX
export const login = (username: string, password: string) =>
  axios.post(`${STAAX_API}/login`, { username, password })

// Portfolio — open endpoints (no auth required)
export const portfolioAPI = {
  holdings:  () => axios.get(`${API}/portfolio/holdings`),
  mf:        () => axios.get(`${API}/portfolio/mf`),
  summary:   () => axios.get(`${API}/portfolio/summary`),
  snapshots: () => axios.get(`${API}/portfolio/snapshots`),
  refresh:   () => axios.post(`${API}/portfolio/refresh`, {}),
}

// SIPs
export const sipsAPI = {
  list:          () => axios.get(`${API}/sips/`, auth()),
  create:        (d: any) => axios.post(`${API}/sips/`, d, auth()),
  update:        (id: string, d: any) => axios.patch(`${API}/sips/${id}`, d, auth()),
  delete:        (id: string) => axios.delete(`${API}/sips/${id}`, auth()),
  executions:    (id: string) => axios.get(`${API}/sips/${id}/executions`, auth()),
  allExecutions: () => axios.get(`${API}/sips/executions`, auth()),
}

// IPO Bots
export const ipoAPI = {
  list:   () => axios.get(`${API}/ipo-bots/`, auth()),
  create: (d: any) => axios.post(`${API}/ipo-bots/`, d, auth()),
  update: (id: string, d: any) => axios.patch(`${API}/ipo-bots/${id}`, d, auth()),
  orders: (id: string) => axios.get(`${API}/ipo-bots/${id}/orders`, auth()),
}

// Watchlist
export const watchlistAPI = {
  list:   () => axios.get(`${API}/watchlist/`, auth()),
  add:    (d: any) => axios.post(`${API}/watchlist/`, d, auth()),
  update: (id: string, d: any) => axios.patch(`${API}/watchlist/${id}`, d, auth()),
  remove: (id: string) => axios.delete(`${API}/watchlist/${id}`, auth()),
}

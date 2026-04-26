import axios from 'axios'
import { authHeaders } from '../lib/api'

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:8001'}/api/v1`

const auth = () => ({ headers: authHeaders() })

// Portfolio
export const portfolioAPI = {
  holdings:  () => axios.get(`${API}/portfolio/holdings`, auth()),
  mf:        () => axios.get(`${API}/portfolio/mf`, auth()),
  summary:   () => axios.get(`${API}/portfolio/summary`, auth()),
  snapshots: () => axios.get(`${API}/portfolio/snapshots`, auth()),
  refresh:   () => axios.post(`${API}/portfolio/refresh`, {}, auth()),
}

// SIPs
export const sipsAPI = {
  list:              () => axios.get(`${API}/sips/`, auth()),
  create:            (d: any) => axios.post(`${API}/sips/`, d, auth()),
  update:            (id: string, d: any) => axios.patch(`${API}/sips/${id}`, d, auth()),
  delete:            (id: string) => axios.delete(`${API}/sips/${id}`, auth()),
  executions:        (id: string) => axios.get(`${API}/sips/${id}/executions`, auth()),
  allExecutions:     () => axios.get(`${API}/sips/executions`, auth()),
  executeNow:        () => axios.post(`${API}/sips/execute-now`, {}, auth()),
  executeNowForSip:  (id: string) => axios.post(`${API}/sips/${id}/execute`, {}, auth()),
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
  list:      () => axios.get(`${API}/watchlist/`, auth()),
  add:       (d: any) => axios.post(`${API}/watchlist/`, d, auth()),
  update:    (id: string, d: any) => axios.patch(`${API}/watchlist/${id}`, d, auth()),
  remove:    (id: string) => axios.delete(`${API}/watchlist/${id}`, auth()),
  getPrices: () => axios.get(`${API}/watchlist/prices`, auth()),
}

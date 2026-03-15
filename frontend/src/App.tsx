import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import LoginPage from "./pages/LoginPage"
import Layout from "./components/Layout"
import PortfolioPage from "./pages/PortfolioPage"
import SIPsPage from "./pages/SIPsPage"
import IPOBotsPage from "./pages/IPOBotsPage"
import WatchlistPage from "./pages/WatchlistPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("invex_token")
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/portfolio" replace />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="sips" element={<SIPsPage />} />
          <Route path="ipo-bots" element={<IPOBotsPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

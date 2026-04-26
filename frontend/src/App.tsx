import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./contexts/AuthContext"
import Layout from "./pages/Layout"
import LoginPage from "./pages/LoginPage"
import PortfolioPage from "./pages/PortfolioPage"
import WatchlistPage from "./pages/WatchlistPage"
import AnalysisPage from "./pages/AnalysisPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)',
      color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 13
    }}>
      Loading…
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/portfolio" replace />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

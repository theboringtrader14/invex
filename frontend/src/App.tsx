import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Layout from "./pages/Layout"
import PortfolioPage from "./pages/PortfolioPage"
import SIPsPage from "./pages/SIPsPage"
import IPOBotsPage from "./pages/IPOBotsPage"
import WatchlistPage from "./pages/WatchlistPage"
import AnalysisPage from "./pages/AnalysisPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/portfolio" replace />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="sips" element={<SIPsPage />} />
          <Route path="ipo-bots" element={<IPOBotsPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

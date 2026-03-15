import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { login } from "../services/api"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!username || !password) return
    setLoading(true); setError("")
    try {
      const res = await login(username, password)
      localStorage.setItem("invex_token", res.data.access_token)
      navigate("/portfolio")
    } catch {
      setError("Invalid credentials")
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-primary)" }}>
      <div style={{ width: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontFamily: "'ADLaM Display', serif", fontSize: "36px",
            color: "var(--accent-blue)", marginBottom: "4px" }}>INVEX</div>
          <div style={{ fontSize: "12px", color: "var(--text-dim)", letterSpacing: "0.12em" }}>PORTFOLIO INTELLIGENCE</div>
        </div>
        <div className="card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Username</label>
              <input className="staax-input" value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Password</label>
              <input className="staax-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            {error && <div style={{ fontSize: "12px", color: "var(--red)" }}>❌ {error}</div>}
            <button className="btn btn-primary" style={{ width: "100%", height: "38px", fontSize: "13px", marginTop: "4px" }}
              onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
          <div style={{ marginTop: "16px", fontSize: "11px", color: "var(--text-dim)", textAlign: "center" }}>
            Uses STAAX credentials
          </div>
        </div>
      </div>
    </div>
  )
}

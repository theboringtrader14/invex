import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleLogin = async () => {
    if (!username || !password) return
    setLoading(true); setError("")
    try {
      await login(username, password)
      navigate("/portfolio")
    } catch {
      setError("Invalid credentials")
    } finally { setLoading(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg)", boxShadow: "var(--neu-inset)",
    borderRadius: "var(--r-md)", color: "var(--text)", fontSize: "14px",
    padding: "11px 14px", outline: "none", fontFamily: "var(--font-body)",
    transition: "box-shadow 0.15s"
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)"
    }}>
      <div style={{ width: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "36px",
            fontWeight: 800, color: "var(--text)", marginBottom: "4px"
          }}>
            LIFEX OS · <span style={{ color: "var(--accent)" }}>INVEX</span>
          </div>
          <div style={{
            fontSize: "12px", color: "var(--text-mute)",
            letterSpacing: "0.12em", fontFamily: "var(--font-mono)",
            textTransform: "uppercase"
          }}>PORTFOLIO INTELLIGENCE</div>
        </div>

        <div style={{
          background: "var(--bg-surface)",
          boxShadow: "var(--neu-raised-lg)",
          borderRadius: "var(--r-xl)",
          padding: "28px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{
                fontSize: "10px", color: "var(--text-mute)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em",
                display: "block", marginBottom: "8px", fontFamily: "var(--font-mono)"
              }}>Username</label>
              <input
                style={inputStyle}
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoComplete="username"
              />
            </div>
            <div>
              <label style={{
                fontSize: "10px", color: "var(--text-mute)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em",
                display: "block", marginBottom: "8px", fontFamily: "var(--font-mono)"
              }}>Password</label>
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div style={{
                fontSize: "12px", color: "var(--red)",
                background: "rgba(255,68,68,0.06)", padding: "9px 12px",
                borderRadius: "var(--r-sm)", border: "1px solid rgba(255,68,68,0.20)",
                fontFamily: "var(--font-body)"
              }}>
                {error}
              </div>
            )}
            <button
              style={{
                width: "100%", height: "44px", fontSize: "14px", fontWeight: 700,
                marginTop: "4px",
                background: "var(--bg-surface)",
                boxShadow: loading ? "none" : "var(--neu-raised)",
                border: "none", borderRadius: "var(--r-md)",
                color: "var(--accent)", cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                fontFamily: "var(--font-body)",
                transition: "all 0.2s"
              }}
              onClick={handleLogin}
              disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
          <div style={{ marginTop: "16px", fontSize: "11px", color: "var(--text-mute)", textAlign: "center", fontFamily: "var(--font-body)" }}>
            INVEX account — contact admin for access
          </div>
        </div>
      </div>
    </div>
  )
}

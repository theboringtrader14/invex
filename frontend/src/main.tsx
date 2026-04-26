import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { AuthProvider } from "./contexts/AuthContext"
import "./index.css"

const theme = localStorage.getItem("invex_theme") || "dark"
document.documentElement.setAttribute("data-theme", theme)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)

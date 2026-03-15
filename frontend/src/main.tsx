import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

const theme = localStorage.getItem("invex_theme") || "dark"
document.documentElement.setAttribute("data-theme", theme)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
)

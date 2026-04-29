import ReactDOM from "react-dom/client"
import App from "./App"
import { AuthProvider } from "./contexts/AuthContext"
import "./index.css"
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Flip } from 'gsap/Flip'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, Flip, useGSAP)

const theme = localStorage.getItem("invex_theme") || "dark"
document.documentElement.setAttribute("data-theme", theme)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)

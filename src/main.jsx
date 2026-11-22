import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import ClientPortal from './components/ClientPortal.jsx'
import BrandKit from './components/BrandKit.jsx'
import Landing from './components/Landing.jsx'

// /                 the three ways in (clients, Loyoly, agencies).
// /loyoly           the Loyoly team's tool: Google sign-in, @loyoly.io only.
// /agence           partner agencies: their own account (email + password), then the tool.
// /kit              self-serve brands: their own account (email + password).
// /client/<code>    the client's side: no account, only the access code.
const path = window.location.pathname
const isClientPortal = /^\/client(\/|$)/.test(path)
const isBrandKit = /^\/kit(\/|$)/.test(path)
const isAgency = /^\/agence(\/|$)/.test(path)
const isTeam = /^\/loyoly(\/|$)/.test(path)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isBrandKit ? (
      <BrandKit />
    ) : isClientPortal ? (
      <ClientPortal />
    ) : isAgency ? (
      <App mode="agency" />
    ) : isTeam ? (
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
        <App mode="loyoly" />
      </GoogleOAuthProvider>
    ) : (
      <Landing />
    )}
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import ClientPortal from './components/ClientPortal.jsx'
import BrandKit from './components/BrandKit.jsx'

// /client/<code> is the client's side: no Google sign-in, only the access code.
// /kit is the self-serve brands' side: their own account (email + password).
const path = window.location.pathname
const isClientPortal = /^\/client(\/|$)/.test(path)
const isBrandKit = /^\/kit(\/|$)/.test(path)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isBrandKit ? (
      <BrandKit />
    ) : isClientPortal ? (
      <ClientPortal />
    ) : (
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
        <App />
      </GoogleOAuthProvider>
    )}
  </StrictMode>,
)

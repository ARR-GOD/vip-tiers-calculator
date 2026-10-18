import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import ClientPortal from './components/ClientPortal.jsx'

// /client/<code> is the client's side: no Google sign-in, only the access code.
const isClientPortal = /^\/client(\/|$)/.test(window.location.pathname)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isClientPortal ? (
      <ClientPortal />
    ) : (
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
        <App />
      </GoogleOAuthProvider>
    )}
  </StrictMode>,
)

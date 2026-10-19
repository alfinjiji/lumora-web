import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import AdminApp from './AdminApp'
declare global {
  interface Window {
    auraflareAdminPreview?: boolean
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp preview={window.auraflareAdminPreview === true} />
  </StrictMode>,
)

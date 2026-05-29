import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Agents from './pages/Agents'
import Workflows from './pages/Workflows'
import Monitor from './pages/Monitor'
import './index.css'

function Nav() {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0',
      padding: '0 32px',
      height: '56px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 100,
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '18px',
        letterSpacing: '-0.5px',
        color: 'var(--accent)',
        marginRight: '48px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>▶</span>
        CONDUCTOR
      </div>

      {[
        { to: '/agents', label: 'AGENTS' },
        { to: '/workflows', label: 'WORKFLOWS' },
        { to: '/monitor', label: 'MONITOR' },
      ].map(({ to, label }) => (
        <NavLink key={to} to={to} style={({ isActive }) => ({
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '2px',
          padding: '0 20px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          color: isActive ? 'var(--accent)' : 'var(--text-muted)',
          borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          transition: 'all 0.15s',
        })}>
          {label}
        </NavLink>
      ))}

      <div style={{
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{
          width: '6px', height: '6px',
          borderRadius: '50%',
          background: 'var(--green)',
          boxShadow: '0 0 6px var(--green)',
          animation: 'pulse 2s infinite',
        }} />
        SYSTEM ONLINE
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <div style={{ paddingTop: '56px', height: '100%' }}>
        <Routes>
          <Route path="/" element={<Agents />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/monitor" element={<Monitor />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

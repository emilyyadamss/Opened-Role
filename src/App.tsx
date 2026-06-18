import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StoreProvider, useStore } from './store'
import { Navbar } from './components/Navbar'
import { Toasts } from './components/ui'
import { Discover } from './pages/Discover'
import { ProjectDetail } from './pages/ProjectDetail'
import { NewProject } from './pages/NewProject'
import { People } from './pages/People'
import { PersonDetail } from './pages/PersonDetail'
import { Tools } from './pages/Tools'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'

function Footer() {
  return (
    <div className="container">
      <footer className="footer">
        <span>Opened Role Project. Find the missing person for your projects success.</span>
      </footer>
    </div>
  )
}

function Splash() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand" style={{ justifyContent: 'center' }}>
          <span className="brand-mark" aria-hidden="true" />
          Opened Role
        </div>
        <p className="muted" style={{ marginTop: 18 }}>
          Loading…
        </p>
      </div>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

function Pages() {
  const location = useLocation()
  return (
    <main className="page" key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Discover />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/new" element={<NewProject />} />
        <Route path="/people" element={<People />} />
        <Route path="/people/:id" element={<PersonDetail />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Discover />} />
      </Routes>
    </main>
  )
}

function Authenticated() {
  const { status, authedUserId } = useStore()
  if (status === 'loading') {
    return (
      <>
        <Splash />
        <Toasts />
      </>
    )
  }
  if (!authedUserId) {
    return (
      <>
        <Login />
        <Toasts />
      </>
    )
  }
  return (
    <HashRouter>
      <div className="shell">
        <ScrollToTop />
        <Navbar />
        <Pages />
        <Footer />
        <Toasts />
      </div>
    </HashRouter>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Authenticated />
    </StoreProvider>
  )
}

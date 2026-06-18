import { useState } from 'react'
import { DEMO_PASSWORD, useStore } from '../store'

type Mode = 'signin' | 'signup'

export function Login() {
  const { signIn, signUp } = useStore()

  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setInfo('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    const result =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp({ email, password, name })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.message) {
      // e.g. email-confirmation required: drop back to sign-in with a note.
      setInfo(result.message)
      setMode('signin')
      setPassword('')
    }
    // On full success, the auth listener in the store swaps us into the app.
  }

  const isSignup = mode === 'signup'

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true" />
          Opened Role
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <h1 className="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-sub">
            {isSignup
              ? 'Join the network and find the missing person for your project.'
              : 'Sign in to find the missing person for your project.'}
          </p>

          {isSignup && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                placeholder="Ada Lovelace"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              placeholder="you@example.com"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {info && (
            <p className="auth-sub" style={{ color: 'var(--ink-soft)' }}>
              {info}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={
              submitting ||
              !email.trim() ||
              password.length < 6 ||
              (isSignup && !name.trim())
            }
          >
            {submitting
              ? 'One moment…'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
          </button>

          <div className="auth-resend">
            {isSignup ? (
              <span className="muted">
                Already have an account?{' '}
                <button type="button" className="link-btn" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </span>
            ) : (
              <span className="muted">
                New here?{' '}
                <button type="button" className="link-btn" onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </span>
            )}
          </div>

          {!isSignup && (
            <div className="auth-demo-note">
              <strong>Demo accounts.</strong> Use any seeded email (e.g.{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setEmail('emily@openedrole.dev')
                  setPassword(DEMO_PASSWORD)
                  setError('')
                }}
              >
                emily@openedrole.dev
              </button>
              ) with the password <code>{DEMO_PASSWORD}</code>.
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

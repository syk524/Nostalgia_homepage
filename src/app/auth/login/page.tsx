'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/lib/actions/auth'
import { AuthShell } from '../auth-shell'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <AuthShell>
      <h2 className="text-xl text-ink mb-6">Log In</h2>

      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" name="username" type="text" required
            className="input" placeholder="username" autoComplete="username" />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required
            autoComplete="current-password" className="input" placeholder="••••••••" />
        </div>

        {state?.error && (
          <p className="field-error bg-ember/10 border border-ember/20 rounded px-4 py-2.5 text-sm">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full justify-center mt-2">
          {pending ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      <p className="text-center text-sm text-ink-500 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-ember hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </AuthShell>
  )
}

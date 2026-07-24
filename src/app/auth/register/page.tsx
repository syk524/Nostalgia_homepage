'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { register } from '@/lib/actions/auth'
import { AuthShell } from '../auth-shell'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined)

  return (
    <AuthShell tagline="Start your gallery">
      <h2 className="text-xl text-ink mb-6">Sign Up</h2>

      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" name="username" type="text" required minLength={3}
            className="input" placeholder="username" autoComplete="username" />
        </div>

        <div>
          <label className="label" htmlFor="display_name">Nickname</label>
          <input id="display_name" name="display_name" type="text"
            className="input" placeholder="Optional — shown to others" />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required
            className="input" placeholder="Enter a password" autoComplete="new-password" />
        </div>

        {state?.error && (
          <p className="field-error bg-ember/10 border border-ember/20 rounded px-4 py-2.5 text-sm">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full justify-center mt-2">
          {pending ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-ink-500 mt-6">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-ember hover:underline font-medium">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}

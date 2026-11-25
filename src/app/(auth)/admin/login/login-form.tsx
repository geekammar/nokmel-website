'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { adminUi } from '@/content/ar/admin';
import { authClient } from '@/lib/auth-client';

type ErrorState = 'none' | 'invalid' | 'rate-limited' | 'unavailable' | 'unexpected';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorState>('none');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('none');
    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: '/admin',
      });
      if (signInError) {
        if (signInError.status === 429) {
          setError('rate-limited');
        } else if (signInError.status === 503) {
          setError('unavailable');
        } else {
          setError('invalid');
        }
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('unexpected');
    } finally {
      setSubmitting(false);
    }
  }

  const errorText =
    error === 'invalid'
      ? adminUi.login.invalidCredentials
      : error === 'rate-limited'
        ? adminUi.login.rateLimited
        : error === 'unavailable'
          ? adminUi.login.authUnavailable
          : error === 'unexpected'
            ? adminUi.login.unexpectedError
            : null;

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-6 sm:p-8">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="inline-flex h-14 items-center" style={{ aspectRatio: '1080 / 1408' }}>
          <img
            src="/brand/logos/nokmel-mark-primary-color.svg"
            alt="نكّمل — Nokmel"
            width={44}
            height={57}
            className="h-14 w-auto"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary sm:text-2xl">{adminUi.login.heading}</h1>
          <p className="mt-2 text-sm text-text-secondary">{adminUi.login.subheading}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          id="admin-email"
          label={adminUi.login.emailLabel}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          dir="ltr"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="admin-password" className="text-sm font-semibold text-text-primary">
            {adminUi.login.passwordLabel}
          </label>
          <div className="relative">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              dir="ltr"
              required
              className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-4 pe-16 text-base text-text-primary"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              aria-pressed={showPassword}
              aria-label={showPassword ? adminUi.login.hidePassword : adminUi.login.showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 end-2 my-auto min-h-control rounded-control px-3 text-sm font-semibold text-action-secondary hover:bg-surface"
            >
              {showPassword ? adminUi.login.hidePassword : adminUi.login.showPassword}
            </button>
          </div>
        </div>
        <div aria-live="polite" role="status">
          {errorText ? (
            <p role="alert" className="text-sm font-semibold text-status-error">
              {errorText}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={submitting} size="lg" className="mt-2 w-full">
          {submitting ? adminUi.login.submitting : adminUi.login.submit}
        </Button>
      </form>
    </div>
  );
}

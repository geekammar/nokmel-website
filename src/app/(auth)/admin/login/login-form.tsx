'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { adminUi } from '@/content/ar/admin';
import { authClient, takeSignInRetryAfterSeconds } from '@/lib/auth-client';
import {
  remainingCooldownSeconds,
  resolveSignInCooldownSeconds,
} from '@/lib/login-cooldown';

type ErrorState = 'none' | 'invalid' | 'rate-limited' | 'unavailable' | 'unexpected';

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M2.2 12s3.5-6.3 9.8-6.3S21.8 12 21.8 12s-3.5 6.3-9.8 6.3S2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 6c.46-.08.93-.12 1.4-.12 6.3 0 9.8 6.12 9.8 6.12a18 18 0 0 1-2.2 3.03" />
      <path d="M6.3 6.9A17.7 17.7 0 0 0 2.2 12s3.5 6.12 9.8 6.12c1.5 0 2.86-.35 4.06-.9" />
      <path d="M9.9 10a2.8 2.8 0 0 0 4.05 4.05" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorState>('none');
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (cooldownUntil === null) {
      setCooldownRemaining(0);
      return;
    }
    const update = () => {
      const remaining = remainingCooldownSeconds(cooldownUntil, Date.now());
      setCooldownRemaining(remaining);
      if (remaining === 0) {
        setCooldownUntil(null);
        setError((current) => (current === 'rate-limited' ? 'none' : current));
      }
    };
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (cooldownUntil !== null && Date.now() < cooldownUntil) return;
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
          const seconds = resolveSignInCooldownSeconds(takeSignInRetryAfterSeconds());
          setCooldownRemaining(seconds);
          setCooldownUntil(Date.now() + seconds * 1000);
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
        ? cooldownRemaining > 0
          ? `${adminUi.login.rateLimited} ${adminUi.login.rateLimitedRetry.replace(
              '{seconds}',
              String(cooldownRemaining),
            )}`
          : adminUi.login.rateLimited
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
          <div className="relative" dir="ltr">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              dir="ltr"
              required
              className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-4 pe-14 text-base text-text-primary"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              aria-pressed={showPassword}
              aria-label={showPassword ? adminUi.login.hidePassword : adminUi.login.showPassword}
              title={showPassword ? adminUi.login.hidePassword : adminUi.login.showPassword}
              data-testid="password-visibility-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute end-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control text-action-secondary hover:bg-background"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
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
        <Button
          type="submit"
          disabled={submitting || cooldownRemaining > 0}
          size="lg"
          className="mt-2 w-full"
        >
          {submitting ? adminUi.login.submitting : adminUi.login.submit}
        </Button>
      </form>
    </div>
  );
}

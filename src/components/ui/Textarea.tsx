import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const textareaId = id ?? rest.name;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={textareaId} className="text-sm font-semibold text-text-primary">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        className="w-full rounded-control border border-border-interactive bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
        {...rest}
      />
      {error ? (
        <p id={`${textareaId}-error`} role="alert" className="text-sm text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});

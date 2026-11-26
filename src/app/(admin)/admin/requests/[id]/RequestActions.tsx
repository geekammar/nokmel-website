'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { adminRequestsUi } from '@/content/ar/admin-requests';
import type { JoinRequestStatus } from '@/lib/join/service';
import {
  saveRequestNotesAction,
  updateRequestStatusAction,
} from '../actions';

type Banner = { kind: 'success' | 'error' | 'conflict'; text: string } | null;

const secondaryButton =
  'inline-flex min-h-control items-center justify-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background disabled:cursor-not-allowed disabled:opacity-60';

export function RequestActions({
  id,
  initialRevision,
  initialStatus,
  initialNotes,
}: {
  id: string;
  initialRevision: number;
  initialStatus: JoinRequestStatus;
  initialNotes: string | null;
}) {
  const [revision, setRevision] = useState(initialRevision);
  const [status, setStatus] = useState<JoinRequestStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const busy = savingStatus || savingNotes;

  async function handleSaveStatus() {
    if (busy) return;
    setBanner(null);
    setSavingStatus(true);
    try {
      const result = await updateRequestStatusAction({ id, revision, status });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        return;
      }
      setRevision(result.data.revision);
      setStatus(result.data.status);
      setBanner({ kind: 'success', text: adminRequestsUi.messages.statusSaved });
    } catch {
      setBanner({ kind: 'error', text: adminRequestsUi.messages.unexpected });
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleSaveNotes() {
    if (busy) return;
    setBanner(null);
    setSavingNotes(true);
    try {
      const result = await saveRequestNotesAction({ id, revision, notes });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        return;
      }
      setRevision(result.data.revision);
      setStatus(result.data.status);
      setNotes(result.data.notes ?? '');
      setBanner({ kind: 'success', text: adminRequestsUi.messages.notesSaved });
    } catch {
      setBanner({ kind: 'error', text: adminRequestsUi.messages.unexpected });
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {banner ? (
        <div
          role={banner.kind === 'success' ? 'status' : 'alert'}
          data-testid="request-banner"
          className={`rounded-card border-s-4 p-4 text-sm leading-6 ${
            banner.kind === 'error' || banner.kind === 'conflict'
              ? 'border-status-error bg-background text-text-primary'
              : 'border-status-info bg-background text-text-primary'
          }`}
        >
          <p>{banner.text}</p>
          {banner.kind === 'conflict' ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`${secondaryButton} mt-3`}
            >
              {adminRequestsUi.actions.reloadLatest}
            </button>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="request-status-title" className="rounded-card border border-border-subtle bg-surface p-4">
        <h2 id="request-status-title" className="text-lg font-bold text-text-primary">
          {adminRequestsUi.statusTitle}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {adminRequestsUi.revision}: {revision}
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="request-status" className="text-sm font-semibold text-text-primary">
              {adminRequestsUi.statusLabel}
            </label>
            <select
              id="request-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as JoinRequestStatus)}
              className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-3 text-base text-text-primary"
            >
              <option value="new">{adminRequestsUi.statusNew}</option>
              <option value="contacted">{adminRequestsUi.statusContacted}</option>
              <option value="closed">{adminRequestsUi.statusClosed}</option>
            </select>
          </div>
          <Button
            type="button"
            onClick={handleSaveStatus}
            disabled={busy}
            data-testid="request-save-status"
          >
            {savingStatus ? adminRequestsUi.savingStatus : adminRequestsUi.saveStatus}
          </Button>
        </div>
        <p className="mt-2 text-xs text-text-secondary">{adminRequestsUi.statusHint}</p>
      </section>

      <section aria-labelledby="request-notes-title" className="rounded-card border border-border-subtle bg-surface p-4">
        <h2 id="request-notes-title" className="text-lg font-bold text-text-primary">
          {adminRequestsUi.notesTitle}
        </h2>
        <Textarea
          id="request-notes"
          label={adminRequestsUi.notesLabel}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={4000}
          rows={5}
          className="mt-3"
          aria-describedby="request-notes-hint"
        />
        <p id="request-notes-hint" className="mt-2 text-xs text-text-secondary">
          {adminRequestsUi.notesHint} ({notes.length}/4000)
        </p>
        <div className="mt-3">
          <Button
            type="button"
            onClick={handleSaveNotes}
            disabled={busy}
            data-testid="request-save-notes"
          >
            {savingNotes ? adminRequestsUi.savingNotes : adminRequestsUi.saveNotes}
          </Button>
        </div>
      </section>
    </div>
  );
}

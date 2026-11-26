'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PublicationReviewPanel } from '@/components/admin/PublicationReviewPanel';
import { SeoEditorPanel } from '@/components/admin/SeoEditorPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import {
  CMS_MAX_FAQ_ITEMS,
  CMS_PAGES,
  cmsFaqItemsInputSchema,
  pageEditableSchema,
  type CmsFaqItem,
  type CmsPageKey,
  type EditablePageValues,
  type FieldDescriptor,
} from '@/content/cms/registry';
import { adminContentUi } from '@/content/ar/admin-content';
import { seoFormSchema, type SeoFormValues } from '@/content/cms/seo';
import type { PublicationReview } from '@/content/cms/review';
import type { EditorPageData, EditorSeoData } from '@/lib/cms/service';
import {
  discardDraftAction,
  getPublicationReviewAction,
  publishContentAction,
  saveDraftAction,
  saveSeoDraftAction,
} from '@/app/(admin)/admin/content/actions';

type FaqEditorItem = CmsFaqItem & { isNew?: boolean };
type Banner = {
  kind: 'success' | 'error' | 'info' | 'conflict';
  text: string;
} | null;

function serializeState(values: EditablePageValues, faqItems: FaqEditorItem[]): string {
  return JSON.stringify({
    values,
    faq: faqItems.map((item) => ({
      id: item.isNew ? '' : item.id,
      question: item.question,
      answer: item.answer,
      visible: item.visible,
    })),
  });
}

function serializeSeo(values: SeoFormValues): string {
  return JSON.stringify(values);
}

type EditorTab = 'content' | 'seo';

function tabClass(active: boolean): string {
  return `min-h-control rounded-control px-4 text-sm font-semibold ${
    active
      ? 'bg-action-primary-bg text-action-primary-fg'
      : 'border border-border-interactive bg-transparent text-text-primary hover:bg-background'
  }`;
}

function setAtPath(
  root: unknown,
  path: readonly (string | number)[],
  value: unknown,
): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    const index = Number(head);
    copy[index] = setAtPath(copy[index], rest, value);
    return copy;
  }
  const source =
    root && typeof root === 'object' ? { ...(root as Record<string, unknown>) } : {};
  source[String(head)] = setAtPath(source[String(head)], rest, value);
  return source;
}

function formatTimestamp(value: string | null): string {
  if (!value) return '';
  return `${value.slice(0, 16).replace('T', ' ')} UTC`;
}

function issueMessage(issue: { code?: string }): string {
  if (issue.code === 'too_big') return adminContentUi.messages.fieldTooLong;
  if (issue.code === 'too_small' || issue.code === 'invalid_type') {
    return adminContentUi.messages.fieldRequired;
  }
  return adminContentUi.messages.validation;
}

export function ContentEditor({
  pageKey,
  initial,
}: {
  pageKey: CmsPageKey;
  initial: EditorPageData;
}) {
  const page = CMS_PAGES.find((candidate) => candidate.key === pageKey);
  if (!page) throw new Error('Unknown CMS page');

  const [values, setValues] = useState<EditablePageValues>(initial.values);
  const [faqItems, setFaqItems] = useState<FaqEditorItem[]>(() =>
    (initial.faqItems ?? []).map((item) => ({ ...item })),
  );
  const [revision, setRevision] = useState(initial.revision);
  const [publishedRevision, setPublishedRevision] = useState(initial.publishedRevision);
  const [hasDraft, setHasDraft] = useState(initial.hasDraft);
  const [hasPublished, setHasPublished] = useState(initial.hasPublished);
  const [lastPublishedAt, setLastPublishedAt] = useState(initial.lastPublishedAt);
  const [baseline, setBaseline] = useState(() =>
    serializeState(
      initial.values,
      (initial.faqItems ?? []).map((item) => ({ ...item })),
    ),
  );
  const [activeTab, setActiveTab] = useState<EditorTab>('content');
  const [seoValues, setSeoValues] = useState<SeoFormValues>(initial.seo.values);
  const [seoBaseline, setSeoBaseline] = useState(() => serializeSeo(initial.seo.values));
  const [seoHasDraft, setSeoHasDraft] = useState(initial.seo.hasDraft);
  const [seoHasPublished, setSeoHasPublished] = useState(initial.seo.hasPublished);
  const [seoInvalidDraft, setSeoInvalidDraft] = useState(initial.seo.invalidDraft);
  const [seoInvalidPublished, setSeoInvalidPublished] = useState(
    initial.seo.invalidPublished,
  );
  const [seoErrors, setSeoErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingSeo, setSavingSeo] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<PublicationReview | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmRemoveFaq, setConfirmRemoveFaq] = useState<string | null>(null);
  const newItemCounter = useRef(0);
  const publishButtonRef = useRef<HTMLButtonElement>(null);

  const busy = saving || savingSeo || reviewing || publishing || discarding;
  const contentDirty = serializeState(values, faqItems) !== baseline;
  const seoDirty = serializeSeo(seoValues) !== seoBaseline;
  const dirty = contentDirty || seoDirty;
  const previewHref = `/admin/content/${pageKey}/preview`;

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function confirmLeave(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!dirty) return;
    if (!window.confirm(adminContentUi.actions.leavingConfirm)) {
      event.preventDefault();
    }
  }

  function invalidateReview() {
    setReview((current) => (current ? null : current));
  }

  function updatePath(path: readonly (string | number)[], value: unknown) {
    invalidateReview();
    setValues((current) => setAtPath(current, path, value) as EditablePageValues);
    const key = path.join('.');
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validateForm(): {
    ok: boolean;
    errors: Record<string, string>;
    faqPayload?: { id?: string; question: string; answer: string; visible: boolean }[];
  } {
    const errors: Record<string, string> = {};
    const sectionResult = pageEditableSchema(pageKey).safeParse(values);
    if (!sectionResult.success) {
      for (const issue of sectionResult.error.issues) {
        const key = issue.path.map(String).join('.');
        errors[key] ??= issueMessage(issue);
      }
    }

    let faqPayload:
      | { id?: string; question: string; answer: string; visible: boolean }[]
      | undefined;
    if (pageKey === 'home') {
      faqPayload = faqItems.map((item) => ({
        id: item.isNew ? undefined : item.id,
        question: item.question,
        answer: item.answer,
        visible: item.visible,
      }));
      const faqResult = cmsFaqItemsInputSchema.safeParse(faqPayload);
      if (!faqResult.success) {
        for (const issue of faqResult.error.issues) {
          const key = `faq.${issue.path.map(String).join('.')}`;
          errors[key] ??= issueMessage(issue);
        }
      }
    }

    setFieldErrors(errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      document
        .querySelector<HTMLElement>(`[data-field="${firstKey}"]`)
        ?.focus();
    }
    return { ok: Object.keys(errors).length === 0, errors, faqPayload };
  }

  async function handleSave() {
    if (busy) return;
    setBanner(null);
    setReview(null);
    const validation = validateForm();
    if (!validation.ok) {
      setBanner({ kind: 'error', text: adminContentUi.messages.fixFields });
      return;
    }

    setSaving(true);
    try {
      const result = await saveDraftAction({
        pageKey,
        revision,
        values,
        faqItems: pageKey === 'home' ? validation.faqPayload : undefined,
      });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        return;
      }
      const savedFaq =
        result.data.faqItems?.map((item) => ({ ...item, isNew: false })) ??
        (pageKey === 'home' ? [] : []);
      setValues(result.data.values);
      setFaqItems(savedFaq);
      setRevision(result.data.revision);
      setPublishedRevision(result.data.publishedRevision);
      setHasDraft(result.data.hasDraft);
      setHasPublished(result.data.hasPublished);
      setLastPublishedAt(result.data.lastPublishedAt);
      setBaseline(serializeState(result.data.values, savedFaq));
      setFieldErrors({});
      setBanner({ kind: 'success', text: adminContentUi.messages.saveSuccess });
    } catch {
      setBanner({ kind: 'error', text: adminContentUi.messages.unexpected });
    } finally {
      setSaving(false);
    }
  }

  function updateSeo(next: SeoFormValues) {
    invalidateReview();
    setSeoValues(next);
    setSeoErrors({});
  }

  async function handleSaveSeo() {
    if (busy) return;
    setBanner(null);
    setReview(null);
    const parsed = seoFormSchema.safeParse(seoValues);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        errors[key] ??= issueMessage(issue);
      }
      setSeoErrors(errors);
      setBanner({ kind: 'error', text: adminContentUi.messages.fixFields });
      const focusId =
        errors.title
          ? 'seo-title'
          : errors.description
            ? 'seo-description'
            : errors.socialTitle
              ? 'seo-social-title'
              : errors.socialDescription
                ? 'seo-social-description'
                : errors.socialImage
                  ? 'seo-social-image'
                  : null;
      if (focusId) document.getElementById(focusId)?.focus();
      return;
    }

    setSavingSeo(true);
    try {
      const result = await saveSeoDraftAction({
        pageKey,
        revision,
        values: parsed.data,
      });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        return;
      }
      setSeoValues(result.data.seo.values);
      setSeoBaseline(serializeSeo(result.data.seo.values));
      setSeoHasDraft(result.data.seo.hasDraft);
      setSeoHasPublished(result.data.seo.hasPublished);
      setSeoInvalidDraft(result.data.seo.invalidDraft);
      setSeoInvalidPublished(result.data.seo.invalidPublished);
      setRevision(result.data.revision);
      setPublishedRevision(result.data.publishedRevision);
      setHasDraft(result.data.hasDraft);
      setHasPublished(result.data.hasPublished);
      setLastPublishedAt(result.data.lastPublishedAt);
      setSeoErrors({});
      setBanner({ kind: 'success', text: adminContentUi.seo.saveSuccess });
    } catch {
      setBanner({ kind: 'error', text: adminContentUi.messages.unexpected });
    } finally {
      setSavingSeo(false);
    }
  }

  async function handlePublish() {
    if (busy) return;
    if (dirty) {
      setBanner({ kind: 'error', text: adminContentUi.messages.publishNeedsSavedDraft });
      return;
    }
    if (!hasDraft) {
      setBanner({ kind: 'error', text: adminContentUi.messages.noDraft });
      return;
    }
    if (review) return;
    if (reviewing) return;

    setReviewing(true);
    setBanner(null);
    try {
      const result = await getPublicationReviewAction({ pageKey, revision });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        if (result.code === 'conflict') setReview(null);
        return;
      }
      setReview(result.data);
    } catch {
      setBanner({ kind: 'error', text: adminContentUi.messages.unexpected });
    } finally {
      setReviewing(false);
    }
  }

  async function handleConfirmPublish() {
    if (!review || publishing) return;
    setPublishing(true);
    setBanner(null);
    try {
      const result = await publishContentAction({
        pageKey,
        revision: review.revision,
      });
      if (!result.ok) {
        const stale = result.code === 'conflict' || result.code === 'no_draft';
        setBanner({
          kind: stale ? 'conflict' : 'error',
          text: stale ? adminContentUi.review.conflictReview : result.message,
        });
        if (stale) setReview(null);
        return;
      }
      setReview(null);
      setHasDraft(false);
      setHasPublished(true);
      setSeoBaseline(serializeSeo(seoValues));
      setSeoHasDraft(false);
      if (seoHasDraft) {
        setSeoHasPublished(true);
        setSeoInvalidDraft(false);
        setSeoInvalidPublished(false);
      }
      setPublishedRevision(result.data.publishedRevision);
      setLastPublishedAt(result.data.lastPublishedAt);
      setBanner({ kind: 'success', text: adminContentUi.messages.publishSuccess });
    } catch {
      setBanner({ kind: 'error', text: adminContentUi.messages.unexpected });
    } finally {
      setPublishing(false);
    }
  }

  function handleCancelPublishReview() {
    if (publishing) return;
    setReview(null);
    setBanner(null);
    window.requestAnimationFrame(() => publishButtonRef.current?.focus());
  }

  async function handleDiscard() {
    if (busy) return;
    if (!confirmDiscard) {
      setReview(null);
      setConfirmDiscard(true);
      setBanner(null);
      return;
    }
    setDiscarding(true);
    setBanner(null);
    try {
      const result = await discardDraftAction({ pageKey, revision });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        return;
      }
      setConfirmDiscard(false);
      setRevision(result.data.revision);
      setHasDraft(result.data.hasDraft);
      setHasPublished(result.data.hasPublished);
      setLastPublishedAt(result.data.lastPublishedAt);
      if (result.data.values) {
        const freshFaq = Array.isArray(result.data.faqItems)
          ? (result.data.faqItems as CmsFaqItem[]).map((item) => ({ ...item }))
          : [];
        setValues(result.data.values as EditablePageValues);
        setFaqItems(freshFaq);
        setBaseline(
          serializeState(result.data.values as EditablePageValues, freshFaq),
        );
        setBanner({ kind: 'success', text: adminContentUi.messages.discardSuccess });
      } else {
        setBanner({ kind: 'success', text: adminContentUi.messages.discardSuccess });
      }
      if (result.data.seo) {
        const freshSeo = result.data.seo as EditorSeoData;
        setSeoValues(freshSeo.values);
        setSeoBaseline(serializeSeo(freshSeo.values));
        setSeoHasDraft(freshSeo.hasDraft);
        setSeoHasPublished(freshSeo.hasPublished);
        setSeoInvalidDraft(freshSeo.invalidDraft);
        setSeoInvalidPublished(freshSeo.invalidPublished);
      }
      setFieldErrors({});
      setSeoErrors({});
    } catch {
      setBanner({ kind: 'error', text: adminContentUi.messages.unexpected });
    } finally {
      setDiscarding(false);
    }
  }

  function addFaqItem() {
    if (faqItems.length >= CMS_MAX_FAQ_ITEMS) return;
    invalidateReview();
    newItemCounter.current += 1;
    setFaqItems((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${newItemCounter.current}`,
        question: '',
        answer: '',
        visible: true,
        isNew: true,
      },
    ]);
  }

  function moveFaqItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= faqItems.length) return;
    invalidateReview();
    setFaqItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateFaqItem(index: number, patch: Partial<FaqEditorItem>) {
    invalidateReview();
    setFaqItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`faq.${index}.`)) delete next[key];
      }
      return next;
    });
  }

  function removeFaqItem(index: number) {
    invalidateReview();
    setConfirmRemoveFaq(null);
    setFaqItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setFieldErrors({});
  }

  const statusText = hasDraft
    ? hasPublished
      ? adminContentUi.status.draftAndPublished
      : adminContentUi.status.draftOnly
    : hasPublished
      ? adminContentUi.status.publishedNoDraft
      : adminContentUi.status.defaultOnly;

  function renderFields(
    fields: readonly FieldDescriptor[],
    container: Record<string, unknown>,
    basePath: readonly (string | number)[],
  ): React.ReactNode {
    return fields.map((field) => {
      const path = [...basePath, field.key];
      const key = path.join('.');
      if (field.kind === 'text') {
        const value = typeof container[field.key] === 'string' ? (container[field.key] as string) : '';
        const common = {
          id: `cms-field-${path.join('-')}`,
          label: field.label,
          value,
          required: true,
          maxLength: field.maxLength,
          autoComplete: 'off',
          'data-field': key,
          error: fieldErrors[key],
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            updatePath(path, event.target.value),
        } as const;
        return (
          <div key={key} className="flex flex-col gap-1">
            {field.multiline ? (
              <Textarea {...common} rows={field.maxLength > 800 ? 6 : 3} />
            ) : (
              <Input {...common} type="text" />
            )}
            {field.help ? (
              <p className="text-xs text-text-secondary">{field.help}</p>
            ) : null}
          </div>
        );
      }

      if (field.kind === 'group') {
        const child =
          container[field.key] && typeof container[field.key] === 'object'
            ? (container[field.key] as Record<string, unknown>)
            : {};
        return (
          <fieldset key={key} className="flex flex-col gap-4 rounded-card border border-border-subtle p-4">
            <legend className="px-1 text-sm font-semibold text-text-primary">
              {field.label}
            </legend>
            {renderFields(field.fields, child, path)}
          </fieldset>
        );
      }

      if (field.kind === 'stringList') {
        const entries = Array.isArray(container[field.key])
          ? (container[field.key] as string[])
          : [];
        return (
          <div key={key} className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-text-primary">{field.label}</p>
            {Array.from({ length: field.length }, (_, index) => {
              const itemPath = [...path, index];
              const itemKey = itemPath.join('.');
              return (
                <Input
                  key={itemKey}
                  id={`cms-field-${itemPath.join('-')}`}
                  label={field.itemLabel(index)}
                  value={entries[index] ?? ''}
                  required
                  maxLength={field.maxLength}
                  autoComplete="off"
                  data-field={itemKey}
                  error={fieldErrors[itemKey]}
                  onChange={(event) => updatePath(itemPath, event.target.value)}
                />
              );
            })}
          </div>
        );
      }

      const entries = Array.isArray(container[field.key])
        ? (container[field.key] as unknown[])
        : [];
      return (
        <div key={key} className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-text-primary">{field.label}</p>
          {entries.map((entry, index) => (
            <fieldset
              key={`${key}-${index}`}
              className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface p-4"
            >
              <legend className="px-1 text-xs font-semibold text-text-secondary">
                {field.itemLabel(index)}
              </legend>
              {renderFields(
                field.fields,
                entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {},
                [...path, index],
              )}
            </fieldset>
          ))}
        </div>
      );
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl" data-testid="content-editor">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/content"
          onClick={confirmLeave}
          className="w-fit text-sm font-semibold text-action-secondary underline-offset-4 hover:underline"
        >
          {adminContentUi.backToContent}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">{page.label}</h1>
        <p className="text-sm text-text-secondary">
          {adminContentUi.pagePathLabel}:{' '}
          <span dir="ltr" className="font-mono text-xs">
            {page.path}
          </span>
        </p>
      </div>

      <div role="tablist" aria-label={adminContentUi.tabs.label} className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          id="page-tab-content"
          aria-selected={activeTab === 'content'}
          aria-controls="page-panel-content"
          data-testid="editor-tab-content"
          className={tabClass(activeTab === 'content')}
          onClick={() => setActiveTab('content')}
        >
          {adminContentUi.tabs.content}
        </button>
        <button
          type="button"
          role="tab"
          id="page-tab-seo"
          aria-selected={activeTab === 'seo'}
          aria-controls="page-panel-seo"
          data-testid="editor-tab-seo"
          className={tabClass(activeTab === 'seo')}
          onClick={() => setActiveTab('seo')}
        >
          {adminContentUi.tabs.seo}
        </button>
      </div>

      <div className="mt-4 rounded-card border border-border-subtle bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary" data-testid="editor-status">
          {statusText}
        </p>
        <p className="mt-1 text-xs text-text-secondary" data-testid="editor-revision">
          {adminContentUi.status.revision}: {revision}
          {' · '}
          {adminContentUi.status.publishedRevision}:{' '}
          {publishedRevision === null ? (
            adminContentUi.status.noPublishedRevision
          ) : (
            publishedRevision
          )}
          {lastPublishedAt ? (
            <>
              {' · '}
              {adminContentUi.status.lastPublished}:{' '}
              <span dir="ltr">{formatTimestamp(lastPublishedAt)}</span>
            </>
          ) : null}
        </p>
        {dirty ? (
          <p className="mt-2 text-sm font-semibold text-status-warning" data-testid="editor-dirty">
            {adminContentUi.status.unsaved}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {activeTab === 'content' ? (
            <Button
              type="button"
              onClick={handleSave}
              disabled={busy || !contentDirty}
              data-testid="save-draft"
            >
              {saving ? adminContentUi.actions.saving : adminContentUi.actions.saveDraft}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSaveSeo}
              disabled={busy || !seoDirty}
              data-testid="save-seo-draft"
            >
              {savingSeo ? adminContentUi.actions.savingSeo : adminContentUi.actions.saveSeoDraft}
            </Button>
          )}
          <Button
            ref={publishButtonRef}
            type="button"
            variant="secondary"
            onClick={handlePublish}
            disabled={busy || dirty || !hasDraft || review !== null}
            data-testid="publish-content"
          >
            {reviewing ? adminContentUi.review.preparing : adminContentUi.actions.publish}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDiscard}
            disabled={busy || !hasDraft || confirmDiscard || review !== null}
            data-testid="discard-draft"
          >
            {discarding ? adminContentUi.actions.discarding : adminContentUi.actions.discard}
          </Button>
          {activeTab === 'content' ? (
            <Link
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={confirmLeave}
              data-testid="preview-link"
              className="inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background"
            >
              {adminContentUi.preview}
            </Link>
          ) : null}
        </div>

        {activeTab === 'content' && contentDirty ? (
          <p className="mt-2 text-xs text-text-secondary">
            {adminContentUi.hints.previewSavedOnly}
          </p>
        ) : hasDraft ? (
          <p className="mt-2 text-xs text-text-secondary">{adminContentUi.hints.draftExists}</p>
        ) : (
          <p className="mt-2 text-xs text-text-secondary">
            {adminContentUi.hints.noStoredDraft}
          </p>
        )}

        {dirty ? (
          <p className="mt-1 text-xs text-text-secondary">{adminContentUi.hints.saveFirst}</p>
        ) : !hasDraft ? (
          <p className="mt-1 text-xs text-text-secondary">{adminContentUi.hints.noDraft}</p>
        ) : null}
        {activeTab === 'content' && seoDirty ? (
          <p className="mt-1 text-xs font-semibold text-status-warning">
            {adminContentUi.seo.otherTabUnsaved}
          </p>
        ) : null}
        {activeTab === 'seo' && contentDirty ? (
          <p className="mt-1 text-xs font-semibold text-status-warning">
            {adminContentUi.seo.otherTabUnsaved}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-text-secondary">
          {adminContentUi.seo.publishStatement}
        </p>

        {review ? (
          <PublicationReviewPanel
            review={review}
            publishing={publishing}
            onConfirm={handleConfirmPublish}
            onCancel={handleCancelPublishReview}
          />
        ) : null}

        {confirmDiscard ? (
          <div
            role="group"
            aria-label={adminContentUi.confirm.discardTitle}
            className="mt-4 rounded-card border-s-4 border-status-warning bg-background p-4"
          >
            <p className="font-semibold text-text-primary">{adminContentUi.confirm.discardTitle}</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {adminContentUi.confirm.discardBody}
            </p>
            {dirty ? (
              <p className="mt-1 text-sm font-semibold text-status-warning">
                {adminContentUi.confirm.discardUnsavedWarning}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleDiscard}
                disabled={busy}
                data-testid="confirm-discard"
              >
                {discarding ? adminContentUi.actions.discarding : adminContentUi.actions.confirmDiscard}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmDiscard(false)}
                disabled={discarding}
              >
                {adminContentUi.actions.cancelDiscard}
              </Button>
            </div>
          </div>
        ) : null}

        <div aria-live="polite" role="status" className="mt-4">
          {banner ? (
            <p
              role={banner.kind === 'error' || banner.kind === 'conflict' ? 'alert' : 'status'}
              className={`text-sm font-semibold ${
                banner.kind === 'success'
                  ? 'text-status-success'
                  : banner.kind === 'conflict' || banner.kind === 'error'
                    ? 'text-status-error'
                    : 'text-text-secondary'
              }`}
            >
              {banner.text}
            </p>
          ) : null}
          {banner?.kind === 'conflict' ? (
            <button
              type="button"
              className="mt-2 min-h-control rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background"
              onClick={() => {
                if (window.confirm(adminContentUi.actions.reloadConfirm)) {
                  window.location.reload();
                }
              }}
            >
              {adminContentUi.actions.reloadLatest}
            </button>
          ) : null}
        </div>
      </div>

      {activeTab === 'content' ? (
      <div
        id="page-panel-content"
        role="tabpanel"
        aria-labelledby="page-tab-content"
        className="mt-8 flex flex-col gap-8"
      >
        {page.sections.map((section) => {
          const sectionValues =
            values[section.key] && typeof values[section.key] === 'object'
              ? (values[section.key] as Record<string, unknown>)
              : {};
          return (
            <section key={section.key} aria-labelledby={`section-${section.key}`}>
              <h2
                id={`section-${section.key}`}
                className="text-lg font-bold text-text-primary"
              >
                {section.label}
              </h2>
              {section.description ? (
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {section.description}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-4">
                {renderFields(section.fields, sectionValues, [section.key])}
              </div>
            </section>
          );
        })}

        {pageKey === 'home' ? (
          <section aria-labelledby="faq-editor-title">
            <h2 id="faq-editor-title" className="text-lg font-bold text-text-primary">
              {adminContentUi.faq.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {adminContentUi.faq.description}
            </p>

            {faqItems.length === 0 ? (
              <p className="mt-4 rounded-card border-s-4 border-status-warning bg-surface p-4 text-sm text-text-secondary">
                {adminContentUi.faq.empty}
              </p>
            ) : (
              <ul className="mt-4 flex list-none flex-col gap-4 p-0">
                {faqItems.map((item, index) => (
                  <li
                    key={item.id}
                    className="rounded-card border border-border-subtle bg-surface p-4"
                    data-testid={`faq-item-${index}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-text-primary">
                        {adminContentUi.faq.itemLabel} {index + 1}
                      </h3>
                      <span className="text-xs font-semibold text-text-secondary">
                        {item.visible ? adminContentUi.faq.visible : adminContentUi.faq.hidden}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-3">
                      <Input
                        id={`cms-faq-${index}-question`}
                        label={adminContentUi.faq.question}
                        value={item.question}
                        required
                        maxLength={300}
                        autoComplete="off"
                        data-field={`faq.${index}.question`}
                        error={fieldErrors[`faq.${index}.question`]}
                        onChange={(event) =>
                          updateFaqItem(index, { question: event.target.value })
                        }
                      />
                      <Textarea
                        id={`cms-faq-${index}-answer`}
                        label={adminContentUi.faq.answer}
                        value={item.answer}
                        required
                        rows={4}
                        maxLength={2000}
                        autoComplete="off"
                        data-field={`faq.${index}.answer`}
                        error={fieldErrors[`faq.${index}.answer`]}
                        onChange={(event) =>
                          updateFaqItem(index, { answer: event.target.value })
                        }
                      />
                    </div>
                    <label className="mt-3 flex min-h-control w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-text-primary">
                      <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={(event) =>
                          updateFaqItem(index, { visible: event.target.checked })
                        }
                        className="h-5 w-5"
                      />
                      {adminContentUi.faq.visible}
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => moveFaqItem(index, -1)}
                        disabled={busy || index === 0}
                        aria-label={`${adminContentUi.faq.moveUp} ${index + 1}`}
                        data-testid={`faq-up-${index}`}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => moveFaqItem(index, 1)}
                        disabled={busy || index === faqItems.length - 1}
                        aria-label={`${adminContentUi.faq.moveDown} ${index + 1}`}
                        data-testid={`faq-down-${index}`}
                      >
                        ↓
                      </Button>
                      {confirmRemoveFaq === item.id ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => removeFaqItem(index)}
                            disabled={busy}
                            data-testid={`faq-confirm-remove-${index}`}
                          >
                            {adminContentUi.faq.confirmRemove}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => setConfirmRemoveFaq(null)}
                            disabled={busy}
                          >
                            {adminContentUi.faq.cancelRemove}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          onClick={() => setConfirmRemoveFaq(item.id)}
                          disabled={busy}
                          data-testid={`faq-remove-${index}`}
                        >
                          {adminContentUi.faq.remove}
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">
                      {adminContentUi.faq.removeHint}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={addFaqItem}
                disabled={busy || faqItems.length >= CMS_MAX_FAQ_ITEMS}
                data-testid="faq-add"
              >
                {adminContentUi.faq.add}
              </Button>
              {faqItems.length >= CMS_MAX_FAQ_ITEMS ? (
                <p className="mt-2 text-xs text-text-secondary">
                  {adminContentUi.faq.limitReached}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

      <div className="mt-8 rounded-card border border-border-subtle bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleSave}
            disabled={busy || !contentDirty}
            data-testid="save-draft-bottom"
          >
            {saving ? adminContentUi.actions.saving : adminContentUi.actions.saveDraft}
          </Button>
          <Link
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={confirmLeave}
            className="inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background"
          >
            {adminContentUi.preview}
          </Link>
          <span className="text-xs text-text-secondary">{adminContentUi.previewNewTabHint}</span>
        </div>
      </div>
      </div>
      ) : (
        <div
          id="page-panel-seo"
          role="tabpanel"
          aria-labelledby="page-tab-seo"
          className="mt-8 flex flex-col gap-4"
        >
          <div className="rounded-card border border-border-subtle bg-surface p-4">
            <p className="text-sm font-semibold text-text-primary" data-testid="seo-status">
              {seoHasDraft
                ? adminContentUi.seo.draftExists
                : seoHasPublished
                  ? adminContentUi.seo.publishedExists
                  : adminContentUi.seo.noOverride}
            </p>
            {seoInvalidDraft ? (
              <p role="alert" className="mt-2 text-sm leading-6 text-status-error">
                {adminContentUi.seo.invalidDraft}
              </p>
            ) : null}
            {seoInvalidPublished ? (
              <p role="alert" className="mt-2 text-sm leading-6 text-status-error">
                {adminContentUi.seo.invalidPublished}
              </p>
            ) : null}
            <p className="mt-1 text-xs leading-6 text-text-secondary">
              {adminContentUi.seo.publishStatement}
            </p>
          </div>

          <SeoEditorPanel
            pageKey={pageKey}
            values={seoValues}
            errors={seoErrors}
            dirty={seoDirty}
            onChange={updateSeo}
            disabled={busy}
          />

          <div className="rounded-card border border-border-subtle bg-surface p-4">
            <Button
              type="button"
              onClick={handleSaveSeo}
              disabled={busy || !seoDirty}
              data-testid="save-seo-draft-bottom"
            >
              {savingSeo ? adminContentUi.actions.savingSeo : adminContentUi.actions.saveSeoDraft}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { adminContentUi } from '@/content/ar/admin-content';
import type { PublicationReview } from '@/content/cms/review';

function formatTimestamp(value: string | null): string {
  if (!value) return '';
  return `${value.slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * Owner-facing publication review. The data is generated server-side from the
 * persisted draft and the effective published/default content in one snapshot;
 * the confirm action must submit the review revision.
 */
export function PublicationReviewPanel({
  review,
  publishing,
  onConfirm,
  onCancel,
}: {
  review: PublicationReview;
  publishing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="publication-review-title"
      data-testid="publication-review"
      className="mt-4 rounded-card border border-border-input bg-background p-4"
    >
      <h3 id="publication-review-title" className="text-base font-bold text-text-primary">
        {adminContentUi.review.title}
      </h3>

      <dl className="mt-3 grid gap-1 text-sm text-text-secondary sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold text-text-primary">
            {adminContentUi.review.pageLabel}:{' '}
          </dt>
          <dd className="inline">{review.pageLabel}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-text-primary">
            {adminContentUi.review.draftRevision}:{' '}
          </dt>
          <dd className="inline" data-testid="review-revision">
            {review.revision}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-text-primary">
            {adminContentUi.review.publishedRevision}:{' '}
          </dt>
          <dd className="inline" data-testid="review-published-revision">
            {review.publishedSource === 'defaults' || review.publishedRevision === null
              ? adminContentUi.review.noPublishedRevision
              : review.publishedRevision}
          </dd>
        </div>
        {review.lastPublishedAt ? (
          <div>
            <dt className="inline font-semibold text-text-primary">
              {adminContentUi.review.lastPublished}:{' '}
            </dt>
            <dd className="inline" dir="ltr">
              {formatTimestamp(review.lastPublishedAt)}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 text-sm leading-6 text-text-secondary">
        {adminContentUi.review.completePage}
      </p>

      <div aria-live="polite" className="mt-3">
        {review.hasChanges ? (
          <p className="text-sm font-semibold text-text-primary">
            {adminContentUi.review.changedSections}: {review.sections.length}
            {review.seo?.changed ? ` · ${adminContentUi.review.seoTitle}` : ''}
            {review.faq?.changed ? ` · ${adminContentUi.review.faqTitle}` : ''}
          </p>
        ) : (
          <p className="text-sm font-semibold text-text-secondary">
            {adminContentUi.review.noChanges}
          </p>
        )}
      </div>

      {review.sections.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2" data-testid="review-section-summary">
          {review.sections.map((section) => (
            <details
              key={section.key}
              className="rounded-card border border-border-subtle bg-surface"
            >
              <summary className="flex min-h-control cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm font-semibold text-text-primary">
                <span>{section.label}</span>
                <span className="text-xs font-normal text-text-secondary">
                  {adminContentUi.review.fieldsCount.replace(
                    '{count}',
                    String(section.fields.length),
                  )}
                </span>
              </summary>
              <ul className="flex list-none flex-col gap-3 border-t border-border-subtle p-4">
                {section.fields.map((change) => (
                  <li key={change.path} className="text-sm">
                    <p className="font-semibold text-text-primary">{change.label}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-text-secondary">
                      <span className="font-semibold">{adminContentUi.review.before}: </span>
                      {change.before}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-text-secondary">
                      <span className="font-semibold">{adminContentUi.review.after}: </span>
                      {change.after}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : null}

      {review.seo?.changed ? (
        <details
          className="mt-3 rounded-card border border-border-subtle bg-surface"
          open
          data-testid="review-seo-summary"
        >
          <summary className="flex min-h-control cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm font-semibold text-text-primary">
            <span>{adminContentUi.review.seoTitle}</span>
            <span className="text-xs font-normal text-text-secondary">
              {adminContentUi.review.seoFieldsCount.replace(
                '{count}',
                String(review.seo.fields.length),
              )}
            </span>
          </summary>
          <ul className="flex list-none flex-col gap-3 border-t border-border-subtle p-4">
            {review.seo.fields.map((field) => (
              <li key={field.key} className="text-sm">
                <p className="font-semibold text-text-primary">
                  {field.label}
                  {field.inheritedBefore || field.inheritedAfter ? (
                    <span className="ms-2 rounded-control bg-background px-2 py-0.5 text-xs font-normal text-text-secondary">
                      {adminContentUi.review.seoInherited}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-text-secondary">
                  <span className="font-semibold">{adminContentUi.review.before}: </span>
                  {field.before}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-text-secondary">
                  <span className="font-semibold">{adminContentUi.review.after}: </span>
                  {field.after}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {review.faq?.changed ? (
        <details
          className="mt-3 rounded-card border border-border-subtle bg-surface"
          open
          data-testid="review-faq-summary"
        >
          <summary className="flex min-h-control cursor-pointer items-center px-4 py-2 text-sm font-semibold text-text-primary">
            {adminContentUi.review.faqTitle}
          </summary>
          <div className="flex flex-col gap-3 border-t border-border-subtle p-4 text-sm">
            {review.faq.added.length > 0 ? (
              <div>
                <p className="font-semibold text-text-primary">
                  {adminContentUi.review.faqAdded}
                </p>
                <ul className="mt-1 list-disc ps-5 text-text-secondary">
                  {review.faq.added.map((item) => (
                    <li key={item.id}>
                      {item.question}{' '}
                      <span className="text-xs text-text-secondary">
                        ({adminContentUi.review.faqEditorPosition.replace('{position}', String(item.position))})
                      </span>{' '}
                      {item.visible && item.visiblePosition !== null ? (
                        <span className="text-xs text-text-secondary">
                          ({adminContentUi.review.faqVisitorPosition.replace('{position}', String(item.visiblePosition))})
                        </span>
                      ) : (
                        <span className="text-xs text-status-warning">
                          — {adminContentUi.review.faqHiddenNoVisitor}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {review.faq.removed.length > 0 ? (
              <div>
                <p className="font-semibold text-text-primary">
                  {adminContentUi.review.faqRemoved}
                </p>
                <ul className="mt-1 list-disc ps-5 text-text-secondary">
                  {review.faq.removed.map((item) => (
                    <li key={item.id}>
                      {item.question}{' '}
                      <span className="text-xs text-text-secondary">
                        ({adminContentUi.review.faqEditorPosition.replace('{position}', String(item.position))})
                      </span>{' '}
                      <span className="text-xs text-text-secondary">
                        ({item.visiblePosition !== null
                          ? adminContentUi.review.faqVisitorPosition.replace('{position}', String(item.visiblePosition))
                          : adminContentUi.review.faqRemovedHidden})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {review.faq.edited.length > 0 ? (
              <div>
                <p className="font-semibold text-text-primary">
                  {adminContentUi.review.faqEdited}
                </p>
                <ul className="mt-1 flex list-none flex-col gap-2 p-0 text-text-secondary">
                  {review.faq.edited.map((item) => (
                    <li key={item.id}>
                      <p className="font-semibold text-text-primary">{item.question}</p>
                      {item.changes.map((change) => (
                        <div key={change.field} className="mt-1">
                          <p className="font-semibold">
                            {change.field === 'question'
                              ? adminContentUi.review.question
                              : adminContentUi.review.answer}
                          </p>
                          <p className="whitespace-pre-wrap break-words">
                            <span className="font-semibold">
                              {adminContentUi.review.before}:{' '}
                            </span>
                            {change.before}
                          </p>
                          <p className="whitespace-pre-wrap break-words">
                            <span className="font-semibold">
                              {adminContentUi.review.after}:{' '}
                            </span>
                            {change.after}
                          </p>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {review.faq.visibilityChanged.length > 0 ? (
              <div>
                <p className="font-semibold text-text-primary">
                  {adminContentUi.review.faqVisibility}
                </p>
                <ul className="mt-1 list-disc ps-5 text-text-secondary">
                  {review.faq.visibilityChanged.map((item) => (
                    <li key={item.id}>
                      {item.question}:{' '}
                      {item.before
                        ? adminContentUi.review.visible
                        : adminContentUi.review.hidden}{' '}
                      → {item.after ? adminContentUi.review.visible : adminContentUi.review.hidden}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {review.faq.reordered ? (
              <p className="font-semibold text-text-primary">
                {adminContentUi.review.faqOrder}
              </p>
            ) : null}
            {review.faq.added.length > 0 ||
            review.faq.removed.length > 0 ||
            review.faq.visibilityChanged.length > 0 ||
            review.faq.reordered ? (
              <div data-testid="review-faq-final-order">
                <p className="font-semibold text-text-primary">
                  {adminContentUi.review.faqFinalOrder}
                </p>
                {review.faq.finalVisibleOrder.length > 0 ? (
                  <ol
                    className="mt-1 list-decimal ps-5 text-text-secondary"
                    data-testid="review-faq-final-order-list"
                  >
                    {review.faq.finalVisibleOrder.map((item) => (
                      <li key={item.id} data-testid="review-faq-final-order-item">
                        {item.question}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-status-warning">
                    {adminContentUi.review.faqEmptyVisible}
                  </p>
                )}
                {review.faq.hidden.length > 0 ? (
                  <div className="mt-3" data-testid="review-faq-hidden">
                    <p className="font-semibold text-text-primary">
                      {adminContentUi.review.faqHidden}
                    </p>
                    <ul className="mt-1 list-disc ps-5 text-text-secondary">
                      {review.faq.hidden.map((item) => (
                        <li key={item.id}>
                          {item.question}{' '}
                          <span className="text-xs">
                            ({adminContentUi.review.faqHiddenPosition.replace('{position}', String(item.position))})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={onConfirm}
          disabled={publishing}
          data-testid="review-confirm-publish"
        >
          {publishing ? adminContentUi.actions.publishing : adminContentUi.review.confirm}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={publishing}
          data-testid="review-cancel"
        >
          {adminContentUi.review.cancel}
        </Button>
      </div>
    </section>
  );
}

import {
  extractPageValues,
  getPageDefinition,
  type CmsFaqItem,
  type CmsPageContent,
  type CmsPageKey,
  type FieldDescriptor,
} from './registry';

/**
 * Pure publication-review model (W3.2 final closure).
 *
 * The service composes and validates the saved draft and the current effective
 * published content from one database snapshot, then this module produces a
 * human-readable summary of the actual persisted differences. It never
 * compares against the client's last editor baseline.
 */

export type PublicationReviewFieldChange = {
  path: string;
  label: string;
  before: string;
  after: string;
};

export type PublicationReviewSection = {
  key: string;
  label: string;
  fields: PublicationReviewFieldChange[];
};

export type PublicationReviewFaqEdit = {
  id: string;
  question: string;
  changes: {
    field: 'question' | 'answer';
    before: string;
    after: string;
  }[];
};

export type PublicationReviewFaqRemoval = {
  id: string;
  question: string;
};

export type PublicationReviewFaqAddition = {
  id: string;
  question: string;
};

export type PublicationReviewFaqVisibility = {
  id: string;
  question: string;
  before: boolean;
  after: boolean;
};

export type PublicationReviewFaq = {
  changed: boolean;
  added: PublicationReviewFaqAddition[];
  removed: PublicationReviewFaqRemoval[];
  edited: PublicationReviewFaqEdit[];
  visibilityChanged: PublicationReviewFaqVisibility[];
  reordered: boolean;
};

export type PublicationReview = {
  pageKey: CmsPageKey;
  pageLabel: string;
  pagePath: string;
  revision: number;
  publishedRevision: number | null;
  lastPublishedAt: string | null;
  publishedSource: 'published' | 'defaults';
  hasChanges: boolean;
  sections: PublicationReviewSection[];
  faq: PublicationReviewFaq | null;
};

function joinLabel(prefix: string | null, label: string): string {
  return prefix ? `${prefix} — ${label}` : label;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function collectFieldChanges(
  fields: readonly FieldDescriptor[],
  draft: Record<string, unknown>,
  published: Record<string, unknown>,
  pathBase: readonly (string | number)[],
  labelPrefix: string | null,
): PublicationReviewFieldChange[] {
  const changes: PublicationReviewFieldChange[] = [];
  for (const field of fields) {
    if (field.kind === 'text') {
      const publishedValue = published[field.key];
      const draftValue = draft[field.key];
      const before = typeof publishedValue === 'string' ? publishedValue : '';
      const after = typeof draftValue === 'string' ? draftValue : '';
      if (before !== after) {
        changes.push({
          path: [...pathBase, field.key].join('.'),
          label: joinLabel(labelPrefix, field.label),
          before,
          after,
        });
      }
      continue;
    }

    if (field.kind === 'group') {
      changes.push(
        ...collectFieldChanges(
          field.fields,
          asRecord(draft[field.key]),
          asRecord(published[field.key]),
          [...pathBase, field.key],
          joinLabel(labelPrefix, field.label),
        ),
      );
      continue;
    }

    if (field.kind === 'stringList') {
      const draftList = Array.isArray(draft[field.key]) ? (draft[field.key] as unknown[]) : [];
      const publishedList = Array.isArray(published[field.key])
        ? (published[field.key] as unknown[])
        : [];
      for (let index = 0; index < field.length; index += 1) {
        const publishedValue = publishedList[index];
        const draftValue = draftList[index];
        const before = typeof publishedValue === 'string' ? publishedValue : '';
        const after = typeof draftValue === 'string' ? draftValue : '';
        if (before !== after) {
          changes.push({
            path: [...pathBase, field.key, index].join('.'),
            label: joinLabel(labelPrefix, field.itemLabel(index)),
            before,
            after,
          });
        }
      }
      continue;
    }

    const draftList = Array.isArray(draft[field.key]) ? (draft[field.key] as unknown[]) : [];
    const publishedList = Array.isArray(published[field.key])
      ? (published[field.key] as unknown[])
      : [];
    for (let index = 0; index < field.length; index += 1) {
      changes.push(
        ...collectFieldChanges(
          field.fields,
          asRecord(draftList[index]),
          asRecord(publishedList[index]),
          [...pathBase, field.key, index],
          joinLabel(labelPrefix, field.itemLabel(index)),
        ),
      );
    }
  }
  return changes;
}

function sectionChanges(
  pageKey: CmsPageKey,
  draftContent: CmsPageContent[CmsPageKey],
  publishedContent: CmsPageContent[CmsPageKey],
): PublicationReviewSection[] {
  const page = getPageDefinition(pageKey);
  const draftValues = extractPageValues(pageKey, draftContent);
  const publishedValues = extractPageValues(pageKey, publishedContent);
  const result: PublicationReviewSection[] = [];

  for (const section of page.sections) {
    const changes = collectFieldChanges(
      section.fields,
      asRecord(draftValues[section.key]),
      asRecord(publishedValues[section.key]),
      [section.key],
      null,
    );
    if (changes.length > 0) {
      result.push({ key: section.key, label: section.label, fields: changes });
    }
  }
  return result;
}

function faqChanges(
  draftItems: readonly CmsFaqItem[],
  publishedItems: readonly CmsFaqItem[],
): PublicationReviewFaq {
  const draftById = new Map(draftItems.map((item) => [item.id, item]));
  const publishedById = new Map(publishedItems.map((item) => [item.id, item]));

  const added = draftItems
    .filter((item) => !publishedById.has(item.id))
    .map((item) => ({ id: item.id, question: item.question }));
  const removed = publishedItems
    .filter((item) => !draftById.has(item.id))
    .map((item) => ({ id: item.id, question: item.question }));

  const edited: PublicationReviewFaqEdit[] = [];
  const visibilityChanged: PublicationReviewFaqVisibility[] = [];

  for (const draftItem of draftItems) {
    const publishedItem = publishedById.get(draftItem.id);
    if (!publishedItem) continue;
    const changes: PublicationReviewFaqEdit['changes'] = [];
    if (draftItem.question !== publishedItem.question) {
      changes.push({
        field: 'question',
        before: publishedItem.question,
        after: draftItem.question,
      });
    }
    if (draftItem.answer !== publishedItem.answer) {
      changes.push({
        field: 'answer',
        before: publishedItem.answer,
        after: draftItem.answer,
      });
    }
    if (changes.length > 0) {
      edited.push({
        id: draftItem.id,
        question: draftItem.question,
        changes,
      });
    }
    if (draftItem.visible !== publishedItem.visible) {
      visibilityChanged.push({
        id: draftItem.id,
        question: draftItem.question,
        before: publishedItem.visible,
        after: draftItem.visible,
      });
    }
  }

  const commonDraftOrder = draftItems
    .filter((item) => publishedById.has(item.id))
    .map((item) => item.id);
  const commonPublishedOrder = publishedItems
    .filter((item) => draftById.has(item.id))
    .map((item) => item.id);
  const reordered =
    commonDraftOrder.length === commonPublishedOrder.length &&
    commonDraftOrder.some((id, index) => id !== commonPublishedOrder[index]);

  return {
    changed:
      added.length > 0 ||
      removed.length > 0 ||
      edited.length > 0 ||
      visibilityChanged.length > 0 ||
      reordered,
    added,
    removed,
    edited,
    visibilityChanged,
    reordered,
  };
}

export function buildPublicationReview(input: {
  pageKey: CmsPageKey;
  draftContent: CmsPageContent[CmsPageKey];
  publishedContent: CmsPageContent[CmsPageKey];
  draftFaq: readonly CmsFaqItem[] | null;
  publishedFaq: readonly CmsFaqItem[] | null;
  revision: number;
  publishedRevision: number | null;
  lastPublishedAt: string | null;
  publishedSource: 'published' | 'defaults';
}): PublicationReview {
  const page = getPageDefinition(input.pageKey);
  const sections = sectionChanges(
    input.pageKey,
    input.draftContent,
    input.publishedContent,
  );
  const faq =
    input.pageKey === 'home' && input.draftFaq && input.publishedFaq
      ? faqChanges(input.draftFaq, input.publishedFaq)
      : null;

  return {
    pageKey: input.pageKey,
    pageLabel: page.label,
    pagePath: page.path,
    revision: input.revision,
    publishedRevision: input.publishedRevision,
    lastPublishedAt: input.lastPublishedAt,
    publishedSource: input.publishedSource,
    hasChanges: sections.length > 0 || (faq?.changed ?? false),
    sections,
    faq,
  };
}

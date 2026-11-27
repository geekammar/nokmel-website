import {
  extractPageValues,
  getPageDefinition,
  type CmsFaqItem,
  type CmsPageContent,
  type CmsPageKey,
  type FieldDescriptor,
} from './registry';
import { resolveEffectiveSeo, type SeoStoredValues } from './seo';

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
  /** One-based position among all published items (editor order). */
  position: number;
  /** One-based position among published visible items, or null if hidden. */
  visiblePosition: number | null;
};

export type PublicationReviewFaqAddition = {
  id: string;
  question: string;
  /** One-based position among all draft items (editor order). */
  position: number;
  /** One-based position among visible draft items, or null if hidden. */
  visiblePosition: number | null;
  visible: boolean;
};

export type PublicationReviewFaqVisibility = {
  id: string;
  question: string;
  before: boolean;
  after: boolean;
};

export type PublicationReviewFaqOrderItem = {
  id: string;
  question: string;
  position: number;
};

export type PublicationReviewFaq = {
  changed: boolean;
  added: PublicationReviewFaqAddition[];
  removed: PublicationReviewFaqRemoval[];
  edited: PublicationReviewFaqEdit[];
  visibilityChanged: PublicationReviewFaqVisibility[];
  finalVisibleOrder: PublicationReviewFaqOrderItem[];
  hidden: PublicationReviewFaqOrderItem[];
  reordered: boolean;
};

export type PublicationReviewSeoFieldKey =
  | 'title'
  | 'description'
  | 'socialTitle'
  | 'socialDescription'
  | 'socialImage';

export type PublicationReviewSeoField = {
  key: PublicationReviewSeoFieldKey;
  label: string;
  before: string;
  after: string;
  inheritedBefore: boolean;
  inheritedAfter: boolean;
};

export type PublicationReviewSeo = {
  changed: boolean;
  fields: PublicationReviewSeoField[];
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
  seo: PublicationReviewSeo | null;
  faq: PublicationReviewFaq | null;
};

const SEO_LABELS: Record<PublicationReviewSeoFieldKey, string> = {
  title: 'عنوان SEO',
  description: 'وصف SEO',
  socialTitle: 'عنوان المشاركة',
  socialDescription: 'وصف المشاركة',
  socialImage: 'صورة المشاركة',
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

    if (field.kind === 'boolean') {
      const before = published[field.key] === true;
      const after = draft[field.key] === true;
      if (before !== after) {
        changes.push({
          path: [...pathBase, field.key].join('.'),
          label: joinLabel(labelPrefix, field.label),
          before: before ? (field.trueLabel ?? 'نعم') : (field.falseLabel ?? 'لا'),
          after: after ? (field.trueLabel ?? 'نعم') : (field.falseLabel ?? 'لا'),
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

  const draftVisiblePositions = new Map<string, number>();
  draftItems
    .filter((item) => item.visible)
    .forEach((item, index) => draftVisiblePositions.set(item.id, index + 1));
  const publishedVisiblePositions = new Map<string, number>();
  publishedItems
    .filter((item) => item.visible)
    .forEach((item, index) => publishedVisiblePositions.set(item.id, index + 1));

  const added = draftItems
    .map((item, index) => ({ item, position: index + 1 }))
    .filter(({ item }) => !publishedById.has(item.id))
    .map(({ item, position }) => ({
      id: item.id,
      question: item.question,
      position,
      visiblePosition: item.visible ? draftVisiblePositions.get(item.id) ?? null : null,
      visible: item.visible,
    }));
  const removed = publishedItems
    .map((item, index) => ({ item, position: index + 1 }))
    .filter(({ item }) => !draftById.has(item.id))
    .map(({ item, position }) => ({
      id: item.id,
      question: item.question,
      position,
      visiblePosition: publishedVisiblePositions.get(item.id) ?? null,
    }));

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

  const finalVisibleOrder = draftItems
    .filter((item) => item.visible)
    .map((item, index) => ({ id: item.id, question: item.question, position: index + 1 }));
  const hidden = draftItems
    .map((item, index) => ({ item, position: index + 1 }))
    .filter(({ item }) => !item.visible)
    .map(({ item, position }) => ({
      id: item.id,
      question: item.question,
      position,
    }));

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
    finalVisibleOrder,
    hidden,
    reordered,
  };
}

function seoChanges(
  pageKey: CmsPageKey,
  draft: SeoStoredValues,
  published: SeoStoredValues | null,
): PublicationReviewSeo {
  const before = resolveEffectiveSeo(pageKey, published);
  const after = resolveEffectiveSeo(pageKey, draft);
  const fields: PublicationReviewSeoField[] = [];

  if (before.title !== after.title) {
    fields.push({
      key: 'title',
      label: SEO_LABELS.title,
      before: before.title,
      after: after.title,
      inheritedBefore: false,
      inheritedAfter: false,
    });
  }
  if (before.description !== after.description) {
    fields.push({
      key: 'description',
      label: SEO_LABELS.description,
      before: before.description,
      after: after.description,
      inheritedBefore: false,
      inheritedAfter: false,
    });
  }
  if (before.socialTitle !== after.socialTitle) {
    fields.push({
      key: 'socialTitle',
      label: SEO_LABELS.socialTitle,
      before: before.socialTitle,
      after: after.socialTitle,
      inheritedBefore: before.socialTitleInherited,
      inheritedAfter: after.socialTitleInherited,
    });
  }
  if (before.socialDescription !== after.socialDescription) {
    fields.push({
      key: 'socialDescription',
      label: SEO_LABELS.socialDescription,
      before: before.socialDescription,
      after: after.socialDescription,
      inheritedBefore: before.socialDescriptionInherited,
      inheritedAfter: after.socialDescriptionInherited,
    });
  }
  if (before.socialImageId !== after.socialImageId) {
    fields.push({
      key: 'socialImage',
      label: SEO_LABELS.socialImage,
      before: before.image.label,
      after: after.image.label,
      inheritedBefore: false,
      inheritedAfter: false,
    });
  }

  return { changed: fields.length > 0, fields };
}

export function buildPublicationReview(input: {
  pageKey: CmsPageKey;
  draftContent: CmsPageContent[CmsPageKey];
  publishedContent: CmsPageContent[CmsPageKey];
  draftFaq: readonly CmsFaqItem[] | null;
  publishedFaq: readonly CmsFaqItem[] | null;
  seo: { draft: SeoStoredValues; published: SeoStoredValues | null } | null;
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
  const seo = input.seo
    ? seoChanges(input.pageKey, input.seo.draft, input.seo.published)
    : null;
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
    hasChanges: sections.length > 0 || (seo?.changed ?? false) || (faq?.changed ?? false),
    sections,
    seo,
    faq,
  };
}

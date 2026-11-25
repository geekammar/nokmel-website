'use client';

import Image from 'next/image';
import { adminContentUi } from '@/content/ar/admin-content';
import {
  CMS_SEO_LIMITS,
  SEO_EDITORIAL_GUIDANCE,
  resolveEffectiveSeoFromForm,
  type SeoFormValues,
} from '@/content/cms/seo';
import { SOCIAL_IMAGES, type SocialImageId } from '@/content/cms/social-images';
import { getPageDefinition, type CmsPageKey } from '@/content/cms/registry';
import { site, siteUrl } from '@/lib/site';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

function guidanceText(length: number, min: number, max: number, template: string): string | null {
  const base = template.replace('{min}', String(min)).replace('{max}', String(max));
  return length > max ? `${base} — ${adminContentUi.seo.overGuidance}` : base;
}

function SearchPreview({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}) {
  return (
    <div
      data-testid="seo-search-preview"
      className="rounded-card border border-border-subtle bg-surface p-4"
    >
      <p className="text-xs text-text-secondary">{adminContentUi.seo.searchPreviewTitle}</p>
      <p dir="ltr" className="mt-2 break-all text-xs text-status-success" data-testid="seo-preview-url">
        {`${siteUrl}${path === '/' ? '' : path}`}
      </p>
      <p
        className="mt-1 break-words text-lg font-semibold leading-7 text-action-secondary"
        data-testid="seo-preview-title"
      >
        {title}
      </p>
      <p
        className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary"
        data-testid="seo-preview-description"
      >
        {description}
      </p>
      <p className="mt-3 text-xs leading-5 text-text-secondary">
        {adminContentUi.seo.searchPreviewNote}
      </p>
    </div>
  );
}

function SocialPreview({
  title,
  description,
  imageId,
}: {
  title: string;
  description: string;
  imageId: SocialImageId;
}) {
  const image = SOCIAL_IMAGES.find((asset) => asset.id === imageId) ?? SOCIAL_IMAGES[0];
  return (
    <div
      data-testid="seo-social-preview"
      className="overflow-hidden rounded-card border border-border-subtle bg-surface"
    >
      <div className="bg-background p-4">
        <Image
          src={image.path}
          alt={image.alt}
          width={image.width}
          height={image.height}
          className="mx-auto h-auto max-h-40 w-auto max-w-full object-contain"
        />
      </div>
      <div className="border-t border-border-subtle p-4">
        <p dir="ltr" className="break-all text-xs text-text-secondary">
          {site.domain}
        </p>
        <p
          className="mt-1 break-words text-base font-semibold text-text-primary"
          data-testid="seo-social-preview-title"
        >
          {title}
        </p>
        <p
          className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary"
          data-testid="seo-social-preview-description"
        >
          {description}
        </p>
      </div>
      <p className="border-t border-border-subtle p-4 text-xs leading-5 text-text-secondary">
        {adminContentUi.seo.socialPreviewNote}
      </p>
    </div>
  );
}

export function SeoEditorPanel({
  pageKey,
  values,
  errors,
  dirty,
  onChange,
  disabled,
}: {
  pageKey: CmsPageKey;
  values: SeoFormValues;
  errors: Record<string, string>;
  dirty: boolean;
  onChange: (values: SeoFormValues) => void;
  disabled: boolean;
}) {
  const page = getPageDefinition(pageKey);
  const effective = resolveEffectiveSeoFromForm(pageKey, values);
  const imageId = values.socialImage === '' ? effective.socialImageId : values.socialImage;
  const titleGuidance = guidanceText(
    values.title.length,
    SEO_EDITORIAL_GUIDANCE.titleMin,
    SEO_EDITORIAL_GUIDANCE.titleMax,
    adminContentUi.seo.guidanceTitle,
  );
  const descriptionGuidance = guidanceText(
    values.description.length,
    SEO_EDITORIAL_GUIDANCE.descriptionMin,
    SEO_EDITORIAL_GUIDANCE.descriptionMax,
    adminContentUi.seo.guidanceDescription,
  );
  const socialTitleGuidance = guidanceText(
    values.socialTitle.length,
    SEO_EDITORIAL_GUIDANCE.titleMin,
    SEO_EDITORIAL_GUIDANCE.titleMax,
    adminContentUi.seo.guidanceTitle,
  );
  const socialDescriptionGuidance = guidanceText(
    values.socialDescription.length,
    SEO_EDITORIAL_GUIDANCE.descriptionMin,
    SEO_EDITORIAL_GUIDANCE.descriptionMax,
    adminContentUi.seo.guidanceDescription,
  );

  function update<K extends keyof SeoFormValues>(key: K, value: SeoFormValues[K]): void {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="seo-editor">
      <div>
        <h2 className="text-lg font-bold text-text-primary">{adminContentUi.seo.title}</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {adminContentUi.seo.description}
        </p>
        <p className="mt-1 text-xs text-text-secondary" dir="ltr">
          {page.path}
        </p>
        {dirty ? (
          <p className="mt-2 text-xs font-semibold text-status-warning">
            {adminContentUi.seo.unsavedPreview}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <Input
              id="seo-title"
              label={adminContentUi.seo.titleLabel}
              value={values.title}
              required
              maxLength={CMS_SEO_LIMITS.title}
              autoComplete="off"
              data-testid="seo-title"
              disabled={disabled}
              error={errors.title}
              aria-describedby="seo-title-help"
              onChange={(event) => update('title', event.target.value)}
            />
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-text-secondary">
              <p id="seo-title-help">{adminContentUi.seo.titleHelp}</p>
              <p dir="ltr" data-testid="seo-title-count">
                {adminContentUi.seo.characterCount.replace('{count}', String(values.title.length))}
              </p>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{titleGuidance}</p>
          </div>

          <div>
            <Textarea
              id="seo-description"
              label={adminContentUi.seo.descriptionLabel}
              value={values.description}
              required
              rows={3}
              maxLength={CMS_SEO_LIMITS.description}
              autoComplete="off"
              data-testid="seo-description"
              disabled={disabled}
              error={errors.description}
              aria-describedby="seo-description-help"
              onChange={(event) => update('description', event.target.value)}
            />
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-text-secondary">
              <p id="seo-description-help">{adminContentUi.seo.descriptionHelp}</p>
              <p dir="ltr" data-testid="seo-description-count">
                {adminContentUi.seo.characterCount.replace(
                  '{count}',
                  String(values.description.length),
                )}
              </p>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{descriptionGuidance}</p>
          </div>

          <div>
            <Input
              id="seo-social-title"
              label={adminContentUi.seo.socialTitleLabel}
              value={values.socialTitle}
              maxLength={CMS_SEO_LIMITS.title}
              autoComplete="off"
              data-testid="seo-social-title"
              disabled={disabled}
              error={errors.socialTitle}
              aria-describedby="seo-social-title-help"
              onChange={(event) => update('socialTitle', event.target.value)}
            />
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-text-secondary">
              <p id="seo-social-title-help">{adminContentUi.seo.socialTitleHelp}</p>
              <p dir="ltr" data-testid="seo-social-title-count">
                {adminContentUi.seo.characterCount.replace(
                  '{count}',
                  String(values.socialTitle.length),
                )}
              </p>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{socialTitleGuidance}</p>
            {effective.socialTitleInherited ? (
              <p className="mt-1 break-words text-xs text-text-secondary" data-testid="seo-social-title-effective">
                {adminContentUi.seo.effectiveValue}: {effective.socialTitle}
              </p>
            ) : null}
          </div>

          <div>
            <Textarea
              id="seo-social-description"
              label={adminContentUi.seo.socialDescriptionLabel}
              value={values.socialDescription}
              rows={3}
              maxLength={CMS_SEO_LIMITS.description}
              autoComplete="off"
              data-testid="seo-social-description"
              disabled={disabled}
              error={errors.socialDescription}
              aria-describedby="seo-social-description-help"
              onChange={(event) => update('socialDescription', event.target.value)}
            />
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-text-secondary">
              <p id="seo-social-description-help">{adminContentUi.seo.socialDescriptionHelp}</p>
              <p dir="ltr" data-testid="seo-social-description-count">
                {adminContentUi.seo.characterCount.replace(
                  '{count}',
                  String(values.socialDescription.length),
                )}
              </p>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{socialDescriptionGuidance}</p>
            {effective.socialDescriptionInherited ? (
              <p
                className="mt-1 break-words text-xs text-text-secondary"
                data-testid="seo-social-description-effective"
              >
                {adminContentUi.seo.effectiveValue}: {effective.socialDescription}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="seo-social-image"
              className="text-sm font-semibold text-text-primary"
            >
              {adminContentUi.seo.socialImageLabel}
            </label>
            <select
              id="seo-social-image"
              data-testid="seo-social-image"
              value={values.socialImage}
              disabled={disabled}
              onChange={(event) => update('socialImage', event.target.value as SocialImageId | '')}
              className="mt-2 min-h-control w-full rounded-control border border-border-interactive bg-surface px-3 text-base text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{adminContentUi.seo.defaultImageOption}</option>
              {SOCIAL_IMAGES.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary">{adminContentUi.seo.socialImageHelp}</p>
            {errors.socialImage ? (
              <p role="alert" className="mt-1 text-sm text-status-error">
                {errors.socialImage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <SearchPreview path={page.path} title={effective.title} description={effective.description} />
          <SocialPreview
            title={effective.socialTitle}
            description={effective.socialDescription}
            imageId={imageId}
          />
        </div>
      </div>
    </div>
  );
}

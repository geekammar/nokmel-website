import { PageHero } from '@/components/sections/Hero';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Input } from '@/components/ui/Input';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import { TextLink } from '@/components/ui/TextLink';
import { publicJoinUi } from '@/content/ar/join-request';
import type { JoinContent } from '@/content/ar/join';
import type { JoinSource } from '@/lib/join/validation';
import type { PublicPlan } from '@/lib/plans/model';
import { JoinForm } from './JoinForm';

export type JoinIntakeViewState = {
  enabled: boolean;
  storageReady: boolean;
  plans: PublicPlan[];
  selectedPlan: PublicPlan | null;
  source: JoinSource;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  requestedPlanUnavailable?: boolean;
};

type JoinMode = 'enabled' | 'disabled' | 'storage_unavailable' | 'preview';

function resolveMode(
  preview: boolean,
  intake: JoinIntakeViewState | undefined,
): JoinMode {
  if (preview) return 'preview';
  if (!intake?.enabled) return 'disabled';
  if (!intake.storageReady) return 'storage_unavailable';
  return 'enabled';
}

function noticeCopy(mode: JoinMode): { title: string; body: string } {
  if (mode === 'enabled') return publicJoinUi.enabledNotice;
  if (mode === 'storage_unavailable') {
    return {
      title: publicJoinUi.storageUnavailableTitle,
      body: publicJoinUi.storageUnavailableBody,
    };
  }
  if (mode === 'preview') {
    return { title: publicJoinUi.previewTitle, body: publicJoinUi.previewBody };
  }
  return {
    title: publicJoinUi.disabledNoticeTitle,
    body: publicJoinUi.disabledNoticeBody,
  };
}

export function JoinView({
  content,
  intake,
  preview = false,
}: {
  content: JoinContent;
  intake?: JoinIntakeViewState;
  preview?: boolean;
}) {
  const mode = resolveMode(preview, intake);
  const notice = noticeCopy(mode);
  const enabled = mode === 'enabled';

  return (
    <>
      <PageHero title={content.hero.title} lead={content.hero.lead} />

      <Section spacing="compact">
        <Container className="flex max-w-3xl flex-col gap-6">
          <p
            role="note"
            data-testid="join-intake-notice"
            className={`rounded-card border border-s-4 bg-surface p-4 text-sm leading-relaxed ${
              enabled ? 'border-status-info' : 'border-status-warning'
            }`}
          >
            <span className="block font-semibold text-text-primary">{notice.title}</span>
            <span className="mt-1 block leading-relaxed text-text-secondary">
              {notice.body}
            </span>
          </p>

          {enabled && intake ? (
            <JoinForm
              content={content}
              plans={intake.plans}
              initialSelectedPlan={intake.selectedPlan}
              source={intake.source}
              utmSource={intake.utmSource}
              utmMedium={intake.utmMedium}
              utmCampaign={intake.utmCampaign}
              requestedPlanUnavailable={intake.requestedPlanUnavailable === true}
            />
          ) : (
            <Card className="flex flex-col gap-5 shadow-sm" data-testid="join-form">
              <h2 className="text-xl font-bold sm:text-2xl">{content.formTitle}</h2>

              <div
                role="group"
                aria-label={content.formTitle}
                className="grid gap-5 sm:grid-cols-2"
              >
                {content.fields.map((field) =>
                  field.type === 'textarea' ? (
                    <Textarea
                      key={field.id}
                      id={field.id}
                      name={field.name}
                      label={field.label}
                      placeholder={field.placeholder}
                      disabled
                      className="sm:col-span-2"
                    />
                  ) : (
                    <Input
                      key={field.id}
                      id={field.id}
                      name={field.name}
                      label={field.label}
                      type={field.type}
                      autoComplete={field.autoComplete}
                      placeholder={field.placeholder}
                      disabled
                      inputMode={field.type === 'tel' ? 'tel' : undefined}
                    />
                  ),
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button disabled size="lg" aria-describedby="join-submit-hint">
                  {content.submit.label}
                </Button>
                <p id="join-submit-hint" className="text-sm text-text-secondary">
                  {mode === 'storage_unavailable'
                    ? publicJoinUi.storageUnavailableBody
                    : publicJoinUi.disabledSubmitHint}
                </p>
              </div>
            </Card>
          )}

          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            <span className="font-semibold">
              {enabled ? 'الخصوصية: ' : `${content.privacyNote.label}: `}
            </span>
            {enabled ? publicJoinUi.privacyEnabled : publicJoinUi.privacyDisabled}{' '}
            <TextLink href={content.privacyNote.link.href}>
              {publicJoinUi.privacyLink}
            </TextLink>
            .
          </p>
          {enabled ? (
            <p className="text-sm font-semibold text-text-secondary">
              {publicJoinUi.noPurchaseNote}
            </p>
          ) : null}
        </Container>
      </Section>
    </>
  );
}

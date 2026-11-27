import { StepsFlow } from '@/components/sections/InfoSection';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { HomeContent } from '@/content/ar/home';

export function HowItWorks({ content }: { content: HomeContent['steps'] }) {
  return (
    <Section id="how-it-works" spacing="compact">
      <Container className="flex flex-col gap-7">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 className="text-2xl font-bold sm:text-3xl">{content.title}</h2>
          <p className="text-sm leading-relaxed text-text-secondary">{content.note}</p>
        </div>
        <StepsFlow steps={content.items} />
      </Container>
    </Section>
  );
}

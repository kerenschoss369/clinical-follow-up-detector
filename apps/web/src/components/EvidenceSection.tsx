interface EvidenceSectionProps {
  evidence: string;
}

export function EvidenceSection({ evidence }: EvidenceSectionProps) {
  return (
    <section className="evidence-section" aria-label="Source evidence">
      <h4 className="evidence-section__title">Evidence</h4>
      <blockquote className="evidence-section__quote">{evidence}</blockquote>
    </section>
  );
}
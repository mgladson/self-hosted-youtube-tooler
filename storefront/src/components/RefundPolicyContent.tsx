import { DEFAULT_LOCALE, messages } from "@/lib/i18n";
import { PageShell } from "./PageShell";

export function RefundPolicyContent() {
  const t = messages[DEFAULT_LOCALE];
  return (
    <PageShell title={t.refund.title} intro={t.refund.intro}>
      <p className="font-body text-[14px] italic text-ink-muted">
        {t.refund.lastModified}
      </p>
      <div className="mt-12 space-y-12">
        {t.refund.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink md:text-[26px]">
              {section.heading}
            </h2>
            <div className="mt-5 space-y-4">
              {section.clauses.map((clause, i) => (
                <p
                  key={i}
                  className="font-body text-[16px] leading-[1.7] text-ink-soft md:text-[17px]"
                >
                  {clause}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

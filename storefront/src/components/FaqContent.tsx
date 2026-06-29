import Link from "next/link";
import { DEFAULT_LOCALE, messages } from "@/lib/i18n";
import { PageShell } from "./PageShell";

function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="mt-4 border-t border-rule-strong">
      {items.map((item) => (
        <details key={item.question} className="group border-b border-rule">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 [&::-webkit-details-marker]:hidden">
            <h3 className="font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-ochre md:text-[21px]">
              {item.question}
            </h3>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-ochre transition-transform duration-300 group-open:rotate-45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </summary>
          <p className="max-w-[680px] pb-6 pr-6 font-body text-[16px] leading-[1.7] text-ink-soft md:text-[17px]">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

export function FaqContent() {
  const t = messages[DEFAULT_LOCALE];
  return (
    <PageShell title={t.faq.title} intro={t.faq.intro}>
      <FaqList items={t.faq.items} />

      <article className="mt-20 border-t-2 border-rule-strong pt-12">
        {t.faq.article.map((block, i) => {
          if (block.kind === "h2") {
            return (
              <h2
                key={i}
                className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink first:mt-0 md:text-[32px]"
              >
                {block.text}
              </h2>
            );
          }
          if (block.kind === "h3") {
            return (
              <h3
                key={i}
                className="mt-8 font-display text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ink md:text-[20px]"
              >
                {block.text}
              </h3>
            );
          }
          return (
            <p
              key={i}
              className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]"
            >
              {block.text}
            </p>
          );
        })}
      </article>

      <h2 className="mt-16 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
        Frequently Asked Questions
      </h2>
      <FaqList items={t.faq.converterFaq} />

      <p className="mt-12 font-body text-[15px] italic leading-[1.7] text-ink-muted">
        Still curious about plans and daily limits? See the{" "}
        <Link
          href="/pricing"
          className="text-ochre-deep underline hover:text-ochre"
        >
          pricing page
        </Link>
        .
      </p>
    </PageShell>
  );
}

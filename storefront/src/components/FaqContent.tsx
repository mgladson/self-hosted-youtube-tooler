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

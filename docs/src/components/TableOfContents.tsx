"use client";

import { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  label: string;
  level: number;
}

export default function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="hidden xl:block fixed top-[60px] right-0 w-[220px] h-[calc(100vh-60px)] overflow-y-auto sidebar-scroll">
      <div className="py-6 pr-4 pl-2">
        <p className="text-[11px] font-semibold text-doc-text-muted uppercase tracking-wider mb-3">
          On this page
        </p>
        <ul className="space-y-0.5 border-l border-doc-border">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block text-[12.5px] py-1 transition-colors ${
                  item.level === 3 ? "pl-5" : "pl-3"
                } ${
                  activeId === item.id
                    ? "text-doc-toc-active font-medium border-l-2 border-doc-toc-active -ml-[1px]"
                    : "text-doc-toc-text hover:text-doc-text"
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface SidebarItem {
  label: string;
  href?: string;
  emoji?: string;
  children?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
  { label: "Introduction", href: "/" },
  { label: "Getting Started", href: "/getting-started", emoji: "🚀" },
  { label: "Platform Overview", href: "/platform-overview", emoji: "📘" },
  { label: "API Reference", href: "/api-reference", emoji: "⚡" },
  { label: "Security & Payments", href: "/security", emoji: "🔒" },
  { label: "Integrations", href: "/integrations", emoji: "🔗" },
  {
    label: "Guides",
    children: [
      { label: "Store Setup", href: "#guides-store-setup" },
      { label: "Theme Customization", href: "#guides-theme" },
      { label: "Product Management", href: "#guides-products" },
    ],
  },
  {
    label: "Storefront",
    children: [
      { label: "Templates", href: "#storefront-templates" },
      { label: "Components", href: "#storefront-components" },
      { label: "Liquid Reference", href: "#storefront-liquid" },
    ],
  },
  {
    label: "Admin",
    children: [
      { label: "Dashboard", href: "#admin-dashboard" },
      { label: "Orders", href: "#admin-orders" },
      { label: "Analytics", href: "#admin-analytics" },
    ],
  },
  {
    label: "Deployment",
    children: [
      { label: "Docker Setup", href: "#deploy-docker" },
      { label: "Environment Config", href: "#deploy-env" },
      { label: "Production Checklist", href: "#deploy-checklist" },
    ],
  },
  {
    label: "Changelog",
    children: [
      { label: "v0.3.0 - Payments", href: "#changelog-030" },
      { label: "v0.2.0 - Admin Panel", href: "#changelog-020" },
      { label: "v0.1.0 - Initial Release", href: "#changelog-010" },
    ],
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
    >
      <path
        d="M4.5 2.5L8 6L4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SidebarCategory({ item }: { item: SidebarItem }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const hasActiveChild = item.children?.some((c) => c.href === pathname);

  return (
    <li>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-[14px] rounded-md transition-colors cursor-pointer ${
          hasActiveChild
            ? "text-doc-text font-medium"
            : "text-doc-text-muted hover:text-doc-text hover:bg-gray-50"
        }`}
      >
        <span>{item.label}</span>
        <ChevronIcon open={open || !!hasActiveChild} />
      </button>
      {(open || hasActiveChild) && item.children && (
        <ul className="ml-3 mt-0.5 border-l border-doc-border pl-0">
          {item.children.map((child) => {
            const isActive = child.href === pathname;
            return (
              <li key={child.label}>
                <Link
                  href={child.href || "/"}
                  className={`block px-3 py-1 text-[13px] transition-colors ${
                    isActive
                      ? "text-doc-link font-medium border-l-2 border-doc-active-border -ml-[1px] bg-doc-active-bg/50"
                      : "text-doc-text-muted hover:text-doc-text"
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function SidebarContent() {
  const pathname = usePathname();

  return (
    <nav className="py-4 px-3">
      <ul className="space-y-0.5">
        {sidebarItems.map((item) => {
          if (item.children) {
            return <SidebarCategory key={item.label} item={item} />;
          }

          const isActive = item.href === pathname;
          return (
            <li key={item.label}>
              <Link
                href={item.href || "/"}
                className={`flex items-center gap-2 px-3 py-1.5 text-[14px] rounded-md transition-colors ${
                  isActive
                    ? "text-doc-link font-medium bg-doc-active-bg border-l-[3px] border-doc-active-border -ml-[1px]"
                    : "text-doc-text-muted hover:text-doc-text hover:bg-gray-50"
                }`}
              >
                {item.emoji && <span className="text-[14px]">{item.emoji}</span>}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-[14px] left-4 z-[60] lg:hidden p-2 rounded-md text-doc-text-muted hover:text-doc-text hover:bg-gray-100 transition-colors"
        aria-label="Open navigation menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Desktop sidebar */}
      <aside className="fixed top-[60px] left-0 w-[260px] h-[calc(100vh-60px)] bg-doc-sidebar border-r border-doc-sidebar-border overflow-y-auto sidebar-scroll hidden lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[70] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed top-0 left-0 w-[280px] h-full bg-doc-sidebar z-[80] lg:hidden overflow-y-auto sidebar-scroll">
            <div className="h-[60px] flex items-center justify-between px-4 border-b border-doc-sidebar-border">
              <span className="text-[15px] font-semibold text-doc-heading">Navigation</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md text-doc-text-muted hover:text-doc-text hover:bg-gray-100 transition-colors"
                aria-label="Close navigation menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}

import type { Metadata } from "next";
import { AccountContent } from "@/components/AccountContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Account",
  description: "Manage your plan and view your daily usage.",
  path: "/account",
  noIndex: true,
});

export default function AccountPage() {
  return <AccountContent />;
}

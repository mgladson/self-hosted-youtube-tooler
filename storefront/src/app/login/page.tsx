import type { Metadata } from "next";
import { LoginContent } from "@/components/LoginContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Sign in",
  description: "Sign in to manage your plan.",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return <LoginContent />;
}

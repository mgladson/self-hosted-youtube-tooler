import Link from "next/link";

export default function NotFound() {
  return (
    <div className="lg:pl-[260px] pt-[60px]">
      <main className="max-w-[820px] mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
        <p className="text-doc-text-muted mb-6">The page you are looking for does not exist.</p>
        <Link href="/" className="text-doc-link hover:underline">Back to docs</Link>
      </main>
    </div>
  );
}

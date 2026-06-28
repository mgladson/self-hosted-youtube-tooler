type SEOPreviewProps = {
  title: string;
  slug: string;
  description: string;
  baseUrl?: string;
};

export function SEOPreview({ title, slug, description, baseUrl = 'findcarehelper.com' }: SEOPreviewProps) {
  const displayTitle = title || 'Page title';
  const displayDesc = description.slice(0, 160) || 'No meta description set.';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-primary">Search Engine Preview</h2>
        <span className="text-[10px] font-medium text-muted bg-surface px-2 py-0.5 rounded-full uppercase tracking-wider">
          Auto-generated
        </span>
      </div>

      <div className="rounded-lg border border-border p-4 bg-white">
        <p className="text-[#1a0dab] text-lg leading-tight truncate">
          {displayTitle} | PixelForge
        </p>
        <p className="text-[#006621] text-sm mt-0.5 truncate">
          {baseUrl}/products/{slug || 'page-slug'}
        </p>
        <p className="text-[#545454] text-sm mt-1 line-clamp-2">
          {displayDesc}
        </p>
      </div>

      <p className="text-xs text-muted mt-3">
        SEO metadata is auto-generated from product name and description. Custom overrides will be available in a future update.
      </p>
    </div>
  );
}

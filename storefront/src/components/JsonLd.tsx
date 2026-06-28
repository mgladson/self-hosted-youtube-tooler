type JsonLdNode = Record<string, unknown> | Record<string, unknown>[];

export function JsonLd({ data, id }: { data: JsonLdNode; id?: string }) {
  return (
    <script
      type="application/ld+json"
      id={id}
      // Schema.org JSON-LD must render as raw JSON in a script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data, (_k, v) => (v === undefined ? undefined : v)),
      }}
    />
  );
}

import { getIndex } from '../../../lib/corpus-store';
import { retrieve } from '../../../lib/rag.mjs';

export async function GET(request: Request) {
  const index = await getIndex();
  if (!index) {
    return Response.json({ loaded: false, documents: 0, sections: 0, section_names: [], sources: [] });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim().slice(0, 1000) || '';
  const sectionFilter = url.searchParams.get('section')?.trim() || '';
  const allDocs: any[] = index.corpus.documents || [];
  const sectionNames = [...new Set(allDocs.map((d: any) => d.section))];

  let sources: any[];
  if (!q) {
    sources = allDocs;
  } else {
    const qLower = q.toLowerCase();
    const direct = allDocs.filter((d: any) =>
      `${d.section} ${d.ref} ${d.text}`.toLowerCase().includes(qLower)
    );
    const ranked = retrieve(index, q, 280);
    const seen = new Set<string>();
    sources = [];
    for (const doc of [...direct, ...ranked]) {
      if (doc && !seen.has(doc.id)) {
        seen.add(doc.id);
        sources.push(doc);
      }
    }
  }

  if (sectionFilter) {
    sources = sources.filter((d: any) => d.section === sectionFilter);
  }

  return Response.json(
    {
      loaded: true,
      documents: index.docs.length,
      sections: index.corpus.sections,
      section_names: sectionNames,
      total_matched: sources.length,
      sources,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

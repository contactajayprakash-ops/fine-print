import { loadBrief } from "@/lib/store";

/** The brief as JSON, for anyone who wants the data without the page. */
export async function GET(_request: Request, { params }: RouteContext<"/api/brief/[id]">) {
  const { id } = await params;
  const brief = await loadBrief(id);
  if (!brief) return Response.json({ error: "No brief with that id." }, { status: 404 });
  return Response.json(brief, { headers: { "Cache-Control": "no-store" } });
}

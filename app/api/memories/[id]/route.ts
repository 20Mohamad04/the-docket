import { NextResponse } from "next/server";
import { authenticateRequest } from "../_lib";

// DELETE /api/memories/[id] — deletes one memory. Scoped by RLS to
// memories this user owns — deleting one you don't own just matches zero
// rows, hence the explicit existence check for a clean 404 instead of a
// misleading 200.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: deleted, error } = await auth.sb
    .from("user_memories")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Failed to delete memory:", error);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}

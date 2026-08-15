import { NextResponse } from "next/server";
import { authenticateRequest } from "./_lib";

// GET /api/memories — list the current user's memories, most recent first.
// Authenticated via the caller's own Supabase access token, same as
// /api/conversations — RLS enforces "only your own rows," not manual
// filtering in this handler.
export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.sb
    .from("user_memories")
    .select("id, content, source, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list memories:", error);
    return NextResponse.json({ error: "Failed to load memories" }, { status: 500 });
  }
  return NextResponse.json({ memories: data ?? [] });
}

// DELETE /api/memories — deletes every memory this user has.
export async function DELETE(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.sb
    .from("user_memories")
    .delete()
    .eq("user_id", auth.userId)
    .select("id");
  if (error) {
    console.error("Failed to clear memories:", error);
    return NextResponse.json({ error: "Failed to clear memories" }, { status: 500 });
  }
  return NextResponse.json({ deleted: (data ?? []).length });
}

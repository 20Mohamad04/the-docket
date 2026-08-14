import { NextResponse } from "next/server";
import { authenticateRequest, removeStoredImages } from "./_lib";

// GET /api/conversations — list the current user's conversations, most
// recent first. Authenticated via the caller's own Supabase access token
// (Authorization: Bearer <token>), not a client-sent userId — RLS on the
// conversations table is what actually enforces "only your own rows" here,
// not manual filtering in this handler.
export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.sb
    .from("conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to list conversations:", error);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
  return NextResponse.json({ conversations: data ?? [] });
}

// DELETE /api/conversations — "clear all history": deletes every
// conversation this user owns. chat_messages rows cascade via the DB
// foreign key; associated chat-images storage objects don't (storage isn't
// part of the same transaction), so those are removed explicitly first.
export async function DELETE(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conversations, error: listError } = await auth.sb
    .from("conversations")
    .select("id");
  if (listError) {
    console.error("Failed to list conversations for deletion:", listError);
    return NextResponse.json({ error: "Failed to delete conversations" }, { status: 500 });
  }

  const ids = (conversations ?? []).map((c) => c.id as string);
  await removeStoredImages(auth.sb, auth.userId, ids);

  const { error: deleteError } = await auth.sb
    .from("conversations")
    .delete()
    .eq("user_id", auth.userId);
  if (deleteError) {
    console.error("Failed to delete conversations:", deleteError);
    return NextResponse.json({ error: "Failed to delete conversations" }, { status: 500 });
  }
  return NextResponse.json({ deleted: ids.length });
}

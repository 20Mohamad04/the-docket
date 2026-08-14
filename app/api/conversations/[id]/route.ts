import { NextResponse } from "next/server";
import { authenticateRequest, removeStoredImages } from "../_lib";

// GET /api/conversations/[id] — loads one conversation's messages, oldest
// first. chat_messages has no user_id column of its own (see the schema
// comment in /api/ask) — ownership flows through conversation_id ->
// conversations.user_id, and RLS enforces that a user can only reach
// messages whose parent conversation they own.
//
// image_url is minted fresh here as a short-lived signed URL from the
// storage PATH that /api/ask actually saved (chat-images is a private
// bucket) — never a long-lived one sitting in the database, so access stays
// governed by the storage RLS policies (and this signed-URL check) every
// time a conversation is reloaded, not just at upload time.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: conversation, error: convError } = await auth.sb
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (convError) {
    console.error("Failed to load conversation:", convError);
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages, error: msgError } = await auth.sb
    .from("chat_messages")
    .select("id, role, content, image_url, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (msgError) {
    console.error("Failed to load chat messages:", msgError);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }

  const signedMessages = await Promise.all(
    (messages ?? []).map(async (m) => {
      if (!m.image_url) return m;
      const { data: signed, error: signError } = await auth.sb.storage
        .from("chat-images")
        .createSignedUrl(m.image_url, 3600);
      if (signError) {
        console.error("Failed to sign chat image URL:", signError);
        return { ...m, image_url: null };
      }
      return { ...m, image_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ conversation, messages: signedMessages });
}

// DELETE /api/conversations/[id] — deletes one conversation. chat_messages
// cascade via the DB foreign key; stored images for it are removed
// explicitly first. Scoped by RLS to conversations this user owns —
// deleting one you don't own just matches zero rows, hence the explicit
// existence check for a clean 404 instead of a misleading 200.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await removeStoredImages(auth.sb, auth.userId, [id]);

  const { data: deleted, error } = await auth.sb
    .from("conversations")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Failed to delete conversation:", error);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}

import { SupabaseClient } from "./supabase-client";

/** Reads the signed-in user's nickname (public.profiles.nickname). Empty string if not yet loaded/set. */
export async function fetchMyNickname(client: SupabaseClient, userId: string): Promise<string> {
  if (!userId) {
    return "";
  }
  const { data, error } = await (client as any).from("profiles").select("nickname").eq("user_id", userId).maybeSingle();
  if (error || !data) {
    return "";
  }
  return data.nickname ?? "";
}

/** Sets the signed-in user's nickname via the set_my_nickname RPC. Returns "" on success, an error message otherwise. */
export async function setMyNickname(client: SupabaseClient, nickname: string): Promise<string> {
  const trimmed = nickname.trim();
  if (!trimmed) {
    return "Nickname cannot be empty.";
  }
  if (trimmed.length > 40) {
    return "Nickname must be 40 characters or fewer.";
  }
  const { error } = await (client as any).rpc("set_my_nickname", { p_nickname: trimmed });
  if (error) {
    return `Could not save nickname: ${error.message}`;
  }
  return "";
}

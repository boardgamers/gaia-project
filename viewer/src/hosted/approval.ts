import { isAdminEmail } from "./admin";

export type ApprovalStatus = "pending" | "approved";

// Admin accounts are always approved (seeded that way by the DB trigger too - this is just the
// client-side fast path so the admin never has to wait on a round trip to see the lobby).
export async function fetchMyApprovalStatus(client: any, session: any): Promise<ApprovalStatus> {
  const email = session?.user?.email ?? null;
  if (isAdminEmail(email)) {
    return "approved";
  }
  const { data, error } = await client
    .from("user_approvals")
    .select("status")
    .eq("user_id", session?.user?.id ?? "")
    .maybeSingle();
  if (error || !data) {
    // Fail closed: an unreadable/missing approval row is treated as not-yet-approved rather
    // than silently granting access.
    return "pending";
  }
  return data.status === "approved" ? "approved" : "pending";
}

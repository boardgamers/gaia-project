export const ADMIN_EMAIL = "kim.pham.nguyen2@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === ADMIN_EMAIL;
}

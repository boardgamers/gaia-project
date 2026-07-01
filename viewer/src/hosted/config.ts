// Public client configuration for the hosted (Supabase) mode.
//
// All three values are public by design (the anon key is shipped to every
// browser; row-level security is what protects the data), so committing them
// as defaults keeps the Vercel deploy zero-config. Env vars still win, for
// pointing a build at another project.

export const supabaseConfig = {
  url: process.env.VUE_APP_SUPABASE_URL || "https://mitawjpdxkheascdiffz.supabase.co",
  anonKey:
    process.env.VUE_APP_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdGF3anBkeGtoZWFzY2RpZmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5Mjc3OTcsImV4cCI6MjA5ODUwMzc5N30.TXqMIk3KMpGycxJ0o952eX8og3F3kAS8gv-I3U2CPe0",
  // base64url raw P-256 public key for PushManager.subscribe (private half
  // lives only in the Supabase app_config table, never in this repo).
  vapidPublicKey:
    process.env.VUE_APP_VAPID_PUBLIC_KEY ||
    "BLXuYk_22qtV1u01UdZYIroP-usPBSd3EV52WfREwDHbdWXCNFMUZeAnuGn1CZTxn9zkLF5J0XCJmHS7dnD9ptI",
};

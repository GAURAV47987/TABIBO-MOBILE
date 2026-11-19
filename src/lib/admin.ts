// Same admin check as the web app's src/admin.js — kept in sync manually.
// Nothing else reads this list; Supabase's RLS (admin_list_trips) does its
// own server-side check on the same email.
const ADMIN_EMAILS = ["patelgaurav77@gmail.com"];

export function isAdmin(session: any) {
  return !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email);
}

import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";

export async function SiteNavShell() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userEmail =
    typeof data?.claims?.email === "string" ? data.claims.email : null;

  return <SiteNav userEmail={userEmail} />;
}

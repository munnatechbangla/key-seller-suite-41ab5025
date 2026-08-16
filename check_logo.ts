
import { supabase } from "./src/integrations/supabase/client.ts";

async function checkLogo() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("group_key", "site")
    .eq("setting_key", "branding")
    .single();

  if (error) {
    console.error("Error fetching branding:", error);
    return;
  }

  console.log("Branding values:", JSON.stringify(data.value, null, 2));
}

checkLogo();

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function listAllPaths(client: any, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const items = data ?? [];
    for (const item of items) {
      const child = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) paths.push(child);
      else paths.push(...await listAllPaths(client, bucket, child));
    }
    if (items.length < 100) break;
    offset += items.length;
  }
  return paths;
}

async function removeTree(client: any, bucket: string, prefix: string) {
  const paths = await listAllPaths(client, bucket, prefix);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await client.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !anonKey || !serviceRole) return json({ error: "Server configuration unavailable" }, 500);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

    const userId = userData.user.id;
    const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: studios, error: studiosError } = await admin.from("studios").select("id").eq("owner_id", userId);
    if (studiosError) throw studiosError;

    await removeTree(admin, "avatars", userId);
    for (const studio of studios ?? []) await removeTree(admin, "portfolio", studio.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
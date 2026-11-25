import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return new Response(null, { status: 401 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return new Response(null, { status: 401 });
  const id = data.user.id;
  const buckets = await admin.storage.listBuckets();
  if (buckets.error) return new Response(null, { status: 500 });
  for (const bucket of ['spot-photos', 'post-photos', 'post-videos', 'avatars'].filter((id) => buckets.data.some((item) => item.id === id))) {
    const storage = admin.storage.from(bucket);
    for (;;) {
      const list = await storage.list(id, { limit: 100 });
      if (list.error) return new Response(null, { status: 500 });
      if (!list.data.length) break;
      const removed = await storage.remove(list.data.map(({ name }) => `${id}/${name}`));
      if (removed.error || !removed.data.length) return new Response(null, { status: 500 });
    }
  }
  const deletion = await admin.auth.admin.deleteUser(id);
  return new Response(null, { status: deletion.error ? 500 : 204 });
});

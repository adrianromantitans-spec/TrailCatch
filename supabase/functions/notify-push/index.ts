import { createClient } from 'npm:@supabase/supabase-js@2';
import { t } from '../../../i18n/index.ts';

const labels = { like: t.notificationLike, comment: t.notificationComment, follower: t.notificationFollow };

Deno.serve(async (request) => {
  const secret = Deno.env.get('TRAILCATCH_WEBHOOK_SECRET');
  if (request.method !== 'POST' || !secret || request.headers.get('x-trailcatch-webhook') !== secret) {
    return new Response(null, { status: 401 });
  }
  const { id } = await request.json();
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const event = await admin.from('notifications').select('id,user_id,type,read').eq('id', id).maybeSingle();
  if (event.error) return new Response(null, { status: 500 });
  if (!event.data || event.data.read) return new Response(null, { status: 204 });
  const notification = event.data;
  if (!Object.hasOwn(labels, notification.type)) return new Response(null, { status: 400 });
  const devices = await admin.from('push_tokens').select('token').eq('user_id', notification.user_id).limit(100);
  if (devices.error) return new Response(null, { status: 500 });
  if (!devices.data.length) return new Response(null, { status: 204 });
  const access = Deno.env.get('EXPO_ACCESS_TOKEN');
  const sent = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(access ? { authorization: `Bearer ${access}` } : {}) },
    body: JSON.stringify(devices.data.map(({ token }) => ({
      to: token, title: t.app, body: labels[notification.type as keyof typeof labels],
      data: { notificationId: id },
    }))),
  });
  if (!sent.ok) return new Response(null, { status: 502 });
  const { data } = await sent.json() as { data?: { status: string; details?: { error?: string } }[] };
  const expired = devices.data.filter((_token, index) => data?.[index]?.details?.error === 'DeviceNotRegistered');
  if (expired.length) await admin.from('push_tokens').delete().eq('user_id', notification.user_id).in('token', expired.map(({ token }) => token));
  return new Response(null, { status: 204 });
});

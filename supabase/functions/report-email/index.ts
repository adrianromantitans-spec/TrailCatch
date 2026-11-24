import { t } from '../../../i18n/index.ts';

Deno.serve(async (request) => {
  const secret = Deno.env.get('TRAILCATCH_WEBHOOK_SECRET');
  if (request.method !== 'POST' || !secret || request.headers.get('x-trailcatch-webhook') !== secret) {
    return new Response(null, { status: 401 });
  }
  const { id } = await request.json();
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  const from = Deno.env.get('REPORT_EMAIL_FROM');
  const to = Deno.env.get('REPORT_EMAIL_TO');
  const key = Deno.env.get('RESEND_API_KEY');
  if (!from || !to || !key) return new Response(null, { status: 503 });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'idempotency-key': `trailcatch-report/${id}` },
    body: JSON.stringify({ from, to: [to], subject: t.adminReportSubject, text: `${t.report} · ${id}` }),
  });
  return new Response(null, { status: response.ok ? 204 : 502 });
});

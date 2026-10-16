/**
 * Contact and comment forms for nxtsmarthome.com.au on Cloudflare Pages.
 *
 * The site is a static export, so a form has nowhere to post. These Pages
 * Functions are that somewhere: /api/contact and /api/comment, each sending the
 * message on through the FXN Stalwart mail server (mail.fxnstudio.com) over
 * SMTP. On the /opt server the same job is done by nxtsmarthome-contact.service.
 *
 * Environment (Pages → Settings → Variables and Secrets):
 *   SMTP_USER, SMTP_PASS   Stalwart account the form sends as (secrets, required)
 *   SMTP_HOST, SMTP_PORT   default mail.fxnstudio.com, 465 (implicit TLS)
 *   CONTACT_TO             where messages go, default contact@nxtsmarthome.com.au
 *   CONTACT_FROM           sender address, default SMTP_USER — Stalwart rejects a
 *                          sender its account does not own
 *   CONTACT_ORIGIN         CORS origin, default https://nxtsmarthome.com.au
 * Optional KV binding CONTACT_THROTTLE enables the per-IP limit.
 */
import { WorkerMailer } from 'worker-mailer';

const WINDOW_S = 10 * 60;
const MAX_PER_WINDOW = 5;
/* Shown to the reader when delivery fails. Vague enough not to leak internals,
   specific enough that a support email says something useful. */
const DELIVERY_HINT = 'our mail server rejected it';

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function config(env) {
  const user = (env.SMTP_USER || '').trim();
  return {
    host: (env.SMTP_HOST || 'mail.fxnstudio.com').trim(),
    port: Number(env.SMTP_PORT || 465),
    user,
    pass: env.SMTP_PASS || '',
    to: (env.CONTACT_TO || 'contact@nxtsmarthome.com.au').trim(),
    from: (env.CONTACT_FROM || user).trim(),
    origin: (env.CONTACT_ORIGIN || 'https://nxtsmarthome.com.au').trim(),
  };
}

function json(cfg, status, body) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': cfg.origin,
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
    },
  });
}

/* Best effort: KV is eventually consistent, so a burst can slip a few extra
   messages through. Without the binding there is no limit beyond the bot checks. */
async function throttled(env, ip) {
  const kv = env.CONTACT_THROTTLE;
  if (!kv || !ip) return false;
  const key = `ip:${ip}`;
  const hits = Number((await kv.get(key)) || 0) + 1;
  await kv.put(key, String(hits), { expirationTtl: WINDOW_S });
  return hits > MAX_PER_WINDOW;
}

async function deliver(cfg, { name, email, topic, message, subject, extra = '' }) {
  if (!cfg.user || !cfg.pass) throw new Error('SMTP_USER / SMTP_PASS are not configured.');
  const text =
    `From: ${name} <${email}>\n` + (topic ? `Topic: ${topic}\n` : '') + extra.replace(/<[^>]+>/g, '') + `\n${message}\n`;
  await WorkerMailer.send(
    {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      credentials: { username: cfg.user, password: cfg.pass },
      authType: ['plain', 'login'],
    },
    {
      from: { name: 'nxtsmarthome.com.au', email: cfg.from },
      to: cfg.to,
      // Replying goes to the reader, not to the sending account.
      reply: { name: name || email, email },
      subject: subject || `[Contact] ${topic || 'Message'} — ${name || email}`,
      text,
      html:
        `<p><strong>From:</strong> ${escape(name)} &lt;${escape(email)}&gt;</p>` +
        (topic ? `<p><strong>Topic:</strong> ${escape(topic)}</p>` : '') +
        extra +
        `<hr><p>${escape(message).replace(/\n/g, '<br>')}</p>`,
    },
  );
}

export async function handleForm({ request, env }, { isComment }) {
  const cfg = config(env);
  if (request.method === 'OPTIONS') return json(cfg, 204, {});
  if (request.method !== 'POST') return json(cfg, 405, { error: 'POST only.' });

  const ip = request.headers.get('cf-connecting-ip') || '';
  if (await throttled(env, ip)) return json(cfg, 429, { error: 'Too many messages. Try again shortly.' });

  const raw = await request.text();
  if (raw.length > 100_000) return json(cfg, 413, { error: 'Message too long.' });
  let data;
  try { data = JSON.parse(raw || '{}'); } catch { return json(cfg, 400, { error: 'Malformed request.' }); }

  const name = String(data.name ?? '').trim().slice(0, 200);
  const email = String(data.email ?? '').trim().slice(0, 320);
  const topic = String(data.topic ?? '').trim().slice(0, 120);
  const message = String(data.message ?? '').trim().slice(0, 10_000);

  /* Both bot checks answer 200 so a bot learns nothing from the response. */
  if (String(data.company ?? '').trim()) return json(cfg, 200, { ok: true });
  if (Number(data.elapsedMs ?? 0) < 2000) return json(cfg, 200, { ok: true });

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(cfg, 400, { error: 'That email address does not look right.' });
  }
  if (!message) return json(cfg, 400, { error: 'The message is empty.' });

  try {
    if (isComment) {
      /* Comments are emailed for moderation: a comment only becomes visible
         once it is added to the article and the site is rebuilt. */
      const article = String(data.slug ?? '').trim().slice(0, 200);
      await deliver(cfg, {
        name, email, message,
        subject: `[Comment] ${article || 'unknown article'} — ${name || email}`,
        extra: `<p><strong>Article:</strong> ${escape(article)}</p>` +
               (data.website ? `<p><strong>Website:</strong> ${escape(String(data.website).slice(0, 300))}</p>` : ''),
      });
    } else {
      await deliver(cfg, { name, email, topic, message });
    }
    return json(cfg, 200, { ok: true });
  } catch (error) {
    console.error(`[${isComment ? 'comment' : 'contact'}] FAILED — ${error.message}`);
    return json(cfg, 502, { error: `The message could not be delivered — ${DELIVERY_HINT}. Please email us at ${cfg.to} instead.` });
  }
}

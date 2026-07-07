import { put, list } from '@vercel/blob';
import { createHash } from 'node:crypto';

// public member key — never expose device ids (they are the account secret)
const mkey = id => createHash('sha256').update('spin-' + id).digest('hex').slice(0, 12);

// crews are the free-text profile.group. Chat is separate per crew; ungrouped
// members share the legacy team chat.
const groupOf = state => String((state && state.profile && state.profile.group) || '').trim();
const groupSlug = g => String(g || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const chatPath = group => { const s = groupSlug(group); return s ? `config/teamchat-${s}.json` : 'config/teamchat.json'; };

async function readBlob(prefix) {
  const { blobs } = await list({ prefix });
  if (!blobs.length) return null;
  const r = await fetch(blobs[0].url + '?_=' + Date.now());
  if (!r.ok) return null;
  return await r.json();
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const id = String(req.query.id || '').replace(/[^a-f0-9]/gi, '');
      if (!id) return res.status(400).json({ error: 'id required' });
      const { blobs } = await list({ prefix: 'users/' });
      const docs = (await Promise.all(blobs.map(async b => {
        try {
          const r = await fetch(b.url + '?_=' + Date.now());
          if (!r.ok) return null;
          return { id: b.pathname.replace(/^users\//, '').replace(/\.json$/, ''), doc: await r.json() };
        } catch (e) { return null; }
      }))).filter(Boolean);
      // feed is crew-only: caller must be an existing member; chat is scoped to their crew
      const meDoc = docs.find(d => d.id === id);
      if (!meDoc) return res.status(403).json({ error: 'unknown member' });
      const myGroup = groupOf(meDoc.doc.state);
      const chat = (await readBlob(chatPath(myGroup))) || [];
      const members = docs.map(d => {
        const st = d.doc.state || {};
        const p = st.profile;
        if (!p || !p.name) return null;
        // summary only — no set detail, no weights/meals/stack/chat/pin
        return {
          key: mkey(d.id),
          name: p.name,
      group: p.group || '',
          streak: st.streak || 0,
          lastActive: d.doc.updated || 0,
          workouts: (st.workouts || []).slice(0, 8).map(w => ({
            type: String(w.type || 'Workout').replace(/^Day \d+ — /, ''), dur: w.dur || 0, sets: w.setsDone || 0,
            vol: w.vol || 0, when: w.when || '', date: w.date || ''
          }))
        };
      }).filter(Boolean);
      return res.status(200).json({ you: mkey(id), members, chat });
    }
    if (req.method === 'POST') {
      const { id, text, delAt } = req.body || {};
      const clean = String(id || '').replace(/[^a-f0-9]/gi, '');
      if (!clean) return res.status(400).json({ error: 'id required' });
      const me = await readBlob(`users/${clean}.json`);
      if (!me || !me.state || !me.state.profile) return res.status(403).json({ error: 'unknown member' });
      const myKey = mkey(clean);
      const myGroup = groupOf(me.state);
      const chat = (await readBlob(chatPath(myGroup))) || [];
      if (delAt) {
        // members can delete only their own messages
        const i = chat.findIndex(m => m.at === delAt && m.k === myKey);
        if (i >= 0) chat.splice(i, 1);
      } else {
        const msg = String(text || '').trim().slice(0, 300);
        if (!msg) return res.status(400).json({ error: 'text required' });
        chat.push({ k: myKey, n: me.state.profile.name || 'Someone', t: msg, at: Date.now() });
        while (chat.length > 100) chat.shift();
      }
      await put(chatPath(myGroup), JSON.stringify(chat), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true, chat });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

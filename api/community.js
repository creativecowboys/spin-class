import { put, list } from '@vercel/blob';
import { createHash } from 'node:crypto';

// public member key — never expose device ids (they are the account secret)
const mkey = id => createHash('sha256').update('spin-' + id).digest('hex').slice(0, 12);

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
      // feed is team-only: caller must be an existing member
      if (!docs.some(d => d.id === id)) return res.status(403).json({ error: 'unknown member' });
      const bumps = (await readBlob('config/bumps.json')) || {};
      const members = docs.map(d => {
        const st = d.doc.state || {};
        const p = st.profile;
        if (!p || !p.name) return null;
        // summary only — no set detail, no weights/meals/stack/chat/pin
        return {
          key: mkey(d.id),
          name: p.name,
          streak: st.streak || 0,
          lastActive: d.doc.updated || 0,
          workouts: (st.workouts || []).slice(0, 8).map(w => ({
            type: w.type || 'Workout', dur: w.dur || 0, sets: w.setsDone || 0,
            vol: w.vol || 0, when: w.when || '', date: w.date || ''
          }))
        };
      }).filter(Boolean);
      return res.status(200).json({ you: mkey(id), members, bumps });
    }
    if (req.method === 'POST') {
      const { id, target, when } = req.body || {};
      const clean = String(id || '').replace(/[^a-f0-9]/gi, '');
      if (!clean || !target || !when) return res.status(400).json({ error: 'id, target, when required' });
      const me = await readBlob(`users/${clean}.json`);
      if (!me || !me.state || !me.state.profile) return res.status(403).json({ error: 'unknown member' });
      const myKey = mkey(clean), myName = me.state.profile.name || 'Someone';
      const bumps = (await readBlob('config/bumps.json')) || {};
      const bkey = String(target).slice(0, 12) + '|' + String(when).slice(0, 80);
      const arr = bumps[bkey] || [];
      const i = arr.findIndex(b => b.k === myKey);
      if (i >= 0) arr.splice(i, 1); else arr.push({ k: myKey, n: myName, at: Date.now() });
      if (arr.length) bumps[bkey] = arr; else delete bumps[bkey];
      // cap the blob: drop the stalest workout keys past 400
      const keys = Object.keys(bumps);
      if (keys.length > 400) {
        keys.sort((a, b) => Math.max(0, ...bumps[a].map(x => x.at || 0)) - Math.max(0, ...bumps[b].map(x => x.at || 0)));
        keys.slice(0, keys.length - 400).forEach(k => delete bumps[k]);
      }
      await put('config/bumps.json', JSON.stringify(bumps), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true, bumps: bumps[bkey] || [] });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

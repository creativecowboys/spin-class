import { put, list } from '@vercel/blob';

// Coach chat is stored PER DEVICE-ID, separate from the member's synced state
// (users/<id>.json). Keeping it out of the last-write-wins state blob means a
// stale device or an evicted localStorage can't wipe the conversation — same
// reasoning as the per-crew community chat.
async function readChat(id) {
  const { blobs } = await list({ prefix: `coachchat/${id}.json` });
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
      const doc = await readChat(id);
      return res.status(200).json({ messages: (doc && doc.messages) || [] });
    }
    if (req.method === 'POST') {
      const { id, messages } = req.body || {};
      const clean = String(id || '').replace(/[^a-f0-9]/gi, '');
      if (!clean) return res.status(400).json({ error: 'bad id' });
      if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
      // keep it small & sane: last 60 turns, role + trimmed text only
      const trimmed = messages.slice(-60).map(m => ({
        role: m && m.role === 'user' ? 'user' : 'assistant',
        content: String((m && m.content) || '').slice(0, 4000)
      }));
      await put(`coachchat/${clean}.json`, JSON.stringify({ messages: trimmed, updated: Date.now() }), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

import { put, list } from '@vercel/blob';

async function readUser(id) {
  const { blobs } = await list({ prefix: `users/${id}.json` });
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
      const doc = await readUser(id);
      if (!doc) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(doc);
    }
    if (req.method === 'POST') {
      const { id, state } = req.body || {};
      if (!id || !state) return res.status(400).json({ error: 'id and state required' });
      const clean = String(id).replace(/[^a-f0-9]/gi, '');
      if (!clean) return res.status(400).json({ error: 'bad id' });
      const doc = { state, updated: Date.now() };
      await put(`users/${clean}.json`, JSON.stringify(doc), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true, updated: doc.updated });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

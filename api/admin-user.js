import { put, list, del } from '@vercel/blob';

export default async function handler(req, res) {
  if (!process.env.ADMIN_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'PUT') {
      const { id, state } = req.body || {};
      if (!id || !state) return res.status(400).json({ error: 'id and state required' });
      const clean = String(id).replace(/[^a-f0-9]/gi, '');
      const doc = { state, updated: Date.now() };
      await put(`users/${clean}.json`, JSON.stringify(doc), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = String(req.query.id || '').replace(/[^a-f0-9]/gi, '');
      if (!id) return res.status(400).json({ error: 'id required' });
      const { blobs } = await list({ prefix: `users/${id}.json` });
      for (const b of blobs) await del(b.url);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

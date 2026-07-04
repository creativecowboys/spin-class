import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (!process.env.ADMIN_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const { blobs } = await list({ prefix: 'users/' });
    const out = [];
    for (const b of blobs.slice(0, 100)) {
      try {
        const r = await fetch(b.url + '?_=' + Date.now());
        const doc = await r.json();
        const id = b.pathname.replace(/^users\//, '').replace(/\.json$/, '');
        out.push({ id, updated: doc.updated || 0, state: doc.state });
      } catch (e) { /* skip corrupt blob */ }
    }
    out.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return res.status(200).json({ users: out });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

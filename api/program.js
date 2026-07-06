import { put, list } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: 'config/program.json' });
      if (!blobs.length) return res.status(404).json({ error: 'no custom program' });
      const r = await fetch(blobs[0].url + '?_=' + Date.now());
      if (!r.ok) return res.status(404).json({ error: 'no custom program' });
      return res.status(200).json(await r.json());
    }
    if (req.method === 'PUT') {
      if (!process.env.ADMIN_KEY || req.headers['x-admin-key'] !== process.env.ADMIN_KEY)
        return res.status(401).json({ error: 'unauthorized' });
      const { days } = req.body || {};
      if (!Array.isArray(days) || days.length < 1 || days.length > 60) return res.status(400).json({ error: 'program must have 1–60 workouts' });
      if (!days.every(d => d && typeof d.name === 'string' && d.name.trim() && Array.isArray(d.ex))) return res.status(400).json({ error: 'every workout needs a name and an exercise list' });
      await put('config/program.json', JSON.stringify({ days, pushed: Date.now() }), {
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

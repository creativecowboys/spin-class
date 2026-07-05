import { put, del } from '@vercel/blob';

// Progress photos: image bytes live in the blob store; the app keeps only
// {url, date} in member state so the synced state stays small.
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { id, dataUrl } = req.body || {};
      const clean = String(id || '').replace(/[^a-f0-9]/gi, '');
      if (!clean || !dataUrl) return res.status(400).json({ error: 'id and image required' });
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl));
      if (!m) return res.status(400).json({ error: 'bad image' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'too large' });
      const ext = m[1] === 'image/png' ? 'png' : (m[1] === 'image/webp' ? 'webp' : 'jpg');
      // addRandomSuffix keeps the URL unguessable (photos are private)
      const blob = await put(`photos/${clean}/p-${Date.now()}.${ext}`, buf, {
        access: 'public', addRandomSuffix: true, contentType: m[1], cacheControlMaxAge: 31536000
      });
      return res.status(200).json({ url: blob.url });
    }
    if (req.method === 'DELETE') {
      const { id, url } = req.body || {};
      const clean = String(id || '').replace(/[^a-f0-9]/gi, '');
      if (!clean || !url) return res.status(400).json({ error: 'id and url required' });
      // only allow deleting within this member's own photo path
      if (!String(url).includes(`/photos/${clean}/`)) return res.status(403).json({ error: 'forbidden' });
      await del(String(url));
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

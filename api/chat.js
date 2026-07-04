export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'API key not configured' });

  const { messages = [], context = '' } = req.body || {};

  const system = `You are the SPIN CLASS coach — the in-app AI coach for SPIN CLASS, a fitness tracking app (joke name, there are no bikes; own it with dry humor if it comes up).

Personality: direct, energetic, encouraging gym-buddy tone. Keep replies short and punchy — 2-4 sentences for most questions. Use the user's real numbers whenever relevant. No emoji spam (one max).

You can see the user's live app data below: profile, targets, today's meals, weight trend, training streak, their position in the PPL Strength A/B program, and their supplement/peptide schedule ("stack").

Rules:
- Nutrition & training: give specific, practical guidance tied to their data and their program (PPL Strength A/B, 6-day; big-3 top sets progress when all sets hit top of rep range at RPE <= 8; accessories use double progression; deload every 4-6 weeks).
- The stack: you may remind them what THEY scheduled and whether it's checked off, but NEVER suggest compounds, doses, timing changes, or protocols — not for peptides, not for any substance. If asked, say dosing decisions belong with their provider, then move on helpfully.
- You are not a doctor; for pain, injury, or medical questions, give sensible general advice and point them to a professional.
- Never invent data that isn't in the context. If something isn't tracked yet, say so and encourage them to log it.

Current user data (JSON):
${context}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 600,
        system,
        messages: messages.slice(-20)
      })
    });
    const data = await r.json();
    if (!r.ok || data.error) {
      return res.status(502).json({ error: (data.error && data.error.message) || 'Upstream error' });
    }
    const text = (data.content || []).map(b => b.text || '').join('');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

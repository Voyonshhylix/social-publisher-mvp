const AYRSHARE_BASE = 'https://api.ayrshare.com/api';
const SUPPORTED = new Set(['linkedin', 'twitter', 'instagram', 'facebook', 'threads', 'tiktok', 'youtube']);

function errorMessage(payload, fallback) {
  if (typeof payload === 'string') return payload;
  return payload?.message || payload?.error || payload?.errors?.[0]?.message || fallback;
}

async function ayrshare(path, options, key) {
  const response = await fetch(`${AYRSHARE_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${key}`, ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(payload, `Ayrshare request failed (${response.status}).`));
  return payload;
}

async function uploadMedia(media, key) {
  if (!media?.data) return null;
  const payload = await ayrshare('/media/upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: media.data, fileName: media.name, description: 'Uploaded from Social Publisher' })
  }, key);
  if (!payload.url) throw new Error('Ayrshare did not return a media URL.');
  return payload.url;
}

function normalizeResults(platforms, payload) {
  const posts = Array.isArray(payload?.postIds) ? payload.postIds : [];
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  return platforms.map(platform => {
    const match = posts.find(item => item.platform === platform) || payload?.[platform];
    const platformError = errors.find(item => item.platform === platform || item.socialNetwork === platform);
    if (platformError) return { platform, status: 'failed', error: errorMessage(platformError, 'Platform rejected the post.') };
    if (match) return { platform, status: 'success', url: match.postUrl || match.url || match.id ? (match.postUrl || match.url || undefined) : undefined };
    return { platform, status: 'pending' };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const key = process.env.SOCIAL_API_KEY;
  if (!key) return res.status(500).json({ error: 'SOCIAL_API_KEY is not configured on the server.' });
  const { content, platforms, media } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Post content is required.' });
  if (!Array.isArray(platforms) || platforms.length === 0) return res.status(400).json({ error: 'Select at least one platform.' });
  const validPlatforms = platforms.filter(platform => SUPPORTED.has(platform));
  if (validPlatforms.length !== platforms.length) return res.status(400).json({ error: 'An unsupported platform was selected.' });
  try {
    const mediaUrl = await uploadMedia(media, key);
    const payload = await ayrshare('/post', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post: content.trim(), platforms: validPlatforms, ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {}) })
    }, key);
    return res.status(200).json({ results: normalizeResults(validPlatforms, payload), raw: payload });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'The social publishing provider could not complete the request.' });
  }
}

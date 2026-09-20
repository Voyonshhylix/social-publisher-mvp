import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', note: 'Professional updates' },
  { id: 'twitter', name: 'X', note: 'Short-form posts' },
  { id: 'instagram', name: 'Instagram', note: 'Media required by network' },
  { id: 'facebook', name: 'Facebook Page', note: 'Pages only' },
  { id: 'threads', name: 'Threads', note: 'Connected account required' },
  { id: 'tiktok', name: 'TikTok', note: 'Video recommended' },
  { id: 'youtube', name: 'YouTube', note: 'Video required by network' }
];

const EXAMPLE = `We just shipped a simpler way for teams to turn one idea into a consistent social campaign.\n\nPick your channels, add media, and publish from one place. #SocialMedia #ProductLaunch`;
const STORAGE_KEY = 'social-publisher-history-v1';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(next) { localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 12))); }
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function App() {
  const [content, setContent] = useState('');
  const [selected, setSelected] = useState([]);
  const [file, setFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => setHistory(loadHistory()), []);
  const selectedNames = useMemo(() => PLATFORMS.filter(p => selected.includes(p.id)).map(p => p.name), [selected]);

  function toggle(id) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  function loadExample() {
    setContent(EXAMPLE);
    setSelected(['linkedin', 'twitter', 'facebook']);
    setResults([]);
    setNotice('Example loaded. Connect those accounts in Ayrshare, then publish.');
  }
  async function publish(event) {
    event.preventDefault();
    setNotice('');
    setResults([]);
    if (!content.trim()) return setNotice('Enter post content before publishing.');
    if (!selected.length) return setNotice('Select at least one platform before publishing.');
    if (file && mediaUrl.trim()) return setNotice('Use either a local file or a public media URL, not both.');
    if (file && file.size > 3 * 1024 * 1024) return setNotice('For a local file, use up to 3 MB. For larger videos, paste a public direct media URL below.');
    setPublishing(true);
    try {
      const media = file ? { name: file.name, type: file.type, data: await readFile(file) } : null;
      const response = await fetch('/api/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), platforms: selected, media, mediaUrl: mediaUrl.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Publishing request failed.');
      const taskResults = data.results || [];
      setResults(taskResults);
      const entry = {
        id: crypto.randomUUID(), content: content.trim(), platforms: selectedNames,
        time: new Date().toISOString(), status: taskResults.every(r => r.status === 'success') ? 'success' : 'partial', results: taskResults
      };
      const next = [entry, ...loadHistory()].slice(0, 12);
      setHistory(next); saveHistory(next);
      setNotice(taskResults.some(r => r.status === 'failed') ? 'Publishing finished with platform-specific failures.' : 'Publishing request completed.');
    } catch (error) {
      const failed = selected.map(platform => ({ platform, status: 'failed', error: error.message }));
      setResults(failed);
      setNotice(error.message);
    } finally { setPublishing(false); }
  }

  return <main className="shell">
    <header>
      <div><p className="eyebrow">MULTI-PLATFORM PUBLISHING</p><h1>Social Publisher</h1></div>
      <button className="secondary" type="button" onClick={loadExample}>Load Example Post</button>
    </header>
    <section className="status-strip" aria-label="Integration status">
      <div><strong>Real</strong><span>One publish request is sent to your linked Ayrshare accounts. Media upload and per-platform results are live API flows.</span></div>
      <div><strong>Mock / not connected</strong><span>None. A platform will fail until its account is linked and permitted in your Ayrshare profile.</span></div>
    </section>
    <div className="grid">
      <form className="composer card" onSubmit={publish}>
        <label htmlFor="content">Post content</label>
        <textarea id="content" value={content} onChange={e => setContent(e.target.value)} placeholder="Write the post you want to share…" rows="9" />
        <div className="form-row"><label htmlFor="media">Image or video <small>optional · local file up to 3 MB</small></label><input id="media" type="file" accept="image/*,video/*" onChange={e => setFile(e.target.files?.[0] || null)} />{file && <p className="file-name">Attached: {file.name}</p>}<label className="url-label" htmlFor="media-url">Or use a public direct media URL <small>recommended for larger videos</small></label><input className="url-input" id="media-url" type="url" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://example.com/video.mp4" /></div>
        <fieldset><legend>Select platforms</legend><div className="platforms">{PLATFORMS.map(platform => <label className={'platform ' + (selected.includes(platform.id) ? 'active' : '')} key={platform.id}><input type="checkbox" checked={selected.includes(platform.id)} onChange={() => toggle(platform.id)} /><span><b>{platform.name}</b><small>{platform.note}</small></span></label>)}</div></fieldset>
        {notice && <p className="notice" role="status">{notice}</p>}
        <button className="publish" disabled={publishing}>{publishing ? 'Publishing…' : `Publish now${selected.length ? ` to ${selected.length}` : ''}`}</button>
      </form>
      <aside className="side">
        <section className="card results"><h2>Publish results</h2>{results.length === 0 ? <p className="muted">Each selected platform will report Pending, Success, or Failed here.</p> : <ul>{results.map(result => <li key={result.platform}><span className={'badge ' + result.status}>{result.status === 'success' ? 'Success' : result.status === 'pending' ? 'Pending' : 'Failed'}</span><div><b>{PLATFORMS.find(p => p.id === result.platform)?.name || result.platform}</b>{result.url && <a href={result.url} target="_blank" rel="noreferrer">Open published post ↗</a>}{result.error && <p className="error">{result.error}</p>}</div></li>)}</ul>}</section>
        <section className="card history"><h2>Recent publishing</h2>{history.length === 0 ? <p className="muted">Your recent tasks are saved in this browser.</p> : <ul>{history.map(item => <li key={item.id}><div><b>{item.content.slice(0, 86)}{item.content.length > 86 ? '…' : ''}</b><small>{new Date(item.time).toLocaleString()} · {item.platforms.join(', ')}</small></div><span className={'badge ' + item.status}>{item.status === 'partial' ? 'Partial' : 'Success'}</span></li>)}</ul>}</section>
      </aside>
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);

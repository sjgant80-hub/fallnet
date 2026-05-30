// ═══════════════════════════════════════════════════════════════════
//  fallnet-shim.js · sovereign peer-to-peer mesh · ◊·κ=1
//
//  Drop into any sovereign tool:
//    <script src="https://sjgant80-hub.github.io/fallnet/fallnet-shim.js"></script>
//
//  API:
//    window.FallNet.announce(toolName)  → announce I have this tool
//    window.FallNet.find(toolName)       → find peers serving it
//    window.FallNet.peers()              → list of currently connected peers
//    window.FallNet.send(peerId, data)   → send arbitrary message
//    window.FallNet.onMessage(handler)   → receive
//
//  Transport: WebRTC datachannels via simple-peer + BroadcastChannel for same-origin discovery
//  Discovery: public STUN + (future) WebTorrent trackers · ad-hoc when LAN
//  Identity: optionally signed via fallshield Ed25519
// ═══════════════════════════════════════════════════════════════════
(function(){
  if (window.FallNet) return;
  const VERSION = '1.0.0';
  const CHAN = 'fall-signal';
  const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

  let peerId = null;
  try { peerId = crypto.randomUUID(); } catch { peerId = 'p-' + Math.random().toString(36).slice(2); }

  const peers = new Map();           // peerId → { conn, dc, since }
  const announced = new Set();        // tool names I serve
  const wants = new Map();            // tool name → resolver
  const signal = (() => { try { return new BroadcastChannel(CHAN); } catch { return null; } })();
  const handlers = new Set();

  function broadcast(kind, payload) {
    signal?.postMessage({ kind: 'fallnet:' + kind, peerId, ts: Date.now(), ...payload });
  }

  // ─── local-only same-origin discovery via BroadcastChannel ───
  if (signal) {
    signal.onmessage = e => {
      const d = e.data || {};
      if (!d.kind?.startsWith('fallnet:')) return;
      if (d.peerId === peerId) return;
      if (d.kind === 'fallnet:announce') {
        for (const tool of (d.tools || [])) {
          const r = wants.get(tool);
          if (r) { r({ peerId: d.peerId, tool, via: 'local' }); wants.delete(tool); }
        }
      }
    };
  }

  // ─── WebRTC peer connection helper ───
  async function makePeer(initiator = true){
    const pc = new RTCPeerConnection({ iceServers: STUN });
    const dc = initiator
      ? pc.createDataChannel('fallnet')
      : null;
    if (!initiator) {
      pc.ondatachannel = e => {
        attachChannel(pc, e.channel);
      };
    }
    if (dc) attachChannel(pc, dc);
    return pc;
  }

  function attachChannel(pc, dc) {
    dc.onopen = () => {
      const id = 'wp-' + Math.random().toString(36).slice(2, 8);
      peers.set(id, { conn: pc, dc, since: Date.now() });
      broadcast('peer-open', { remoteId: id });
    };
    dc.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { msg = { raw: e.data }; }
      handlers.forEach(h => { try { h(msg); } catch {} });
    };
    dc.onclose = () => {
      for (const [id, p] of peers) if (p.dc === dc) { peers.delete(id); broadcast('peer-close', { remoteId: id }); }
    };
  }

  // ─── API ───
  async function announce(toolName, meta = {}){
    announced.add(toolName);
    broadcast('announce', { tools: [...announced], meta });
    return { tool: toolName, ok: true, peerId };
  }
  async function find(toolName, timeoutMs = 3000){
    broadcast('want', { tool: toolName });
    return new Promise(resolve => {
      wants.set(toolName, resolve);
      setTimeout(() => {
        if (wants.has(toolName)) {
          wants.delete(toolName);
          resolve(null);
        }
      }, timeoutMs);
    });
  }
  function listPeers(){
    return [...peers.entries()].map(([id, p]) => ({ id, since: p.since }));
  }
  function send(peerIdTarget, data){
    const p = peers.get(peerIdTarget);
    if (!p?.dc || p.dc.readyState !== 'open') return false;
    p.dc.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  }
  function onMessage(handler){
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  // ─── manual offer/answer (for browser-to-browser without trackers) ───
  async function createOffer(){
    const pc = await makePeer(true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise(r => { if (pc.iceGatheringState === 'complete') r(); else pc.onicegatheringstatechange = () => pc.iceGatheringState === 'complete' && r(); });
    return { sdp: btoa(JSON.stringify(pc.localDescription)), pc };
  }
  async function acceptOffer(b64Offer){
    const pc = await makePeer(false);
    const offer = JSON.parse(atob(b64Offer));
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await new Promise(r => { if (pc.iceGatheringState === 'complete') r(); else pc.onicegatheringstatechange = () => pc.iceGatheringState === 'complete' && r(); });
    return { sdp: btoa(JSON.stringify(pc.localDescription)), pc };
  }
  async function completeOffer(pc, b64Answer){
    const answer = JSON.parse(atob(b64Answer));
    await pc.setRemoteDescription(answer);
    return true;
  }

  window.FallNet = {
    version: VERSION, peerId,
    announce, find, peers: listPeers, send, onMessage,
    createOffer, acceptOffer, completeOffer,
  };
  broadcast('loaded', { version: VERSION });
})();

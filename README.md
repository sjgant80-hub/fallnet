# ◊ fallnet · sovereign peer-to-peer mesh

**Browser-to-browser. No servers. WebRTC. The network IS the estate.**

[**Live**](https://sjgant80-hub.github.io/fallnet/) · [Shim](./fallnet-shim.js) · MIT · ◊·κ=1 · prime 313

## Drop in

```html
<script src="https://sjgant80-hub.github.io/fallnet/fallnet-shim.js"></script>
<script>
  await FallNet.announce('shadowcompass');           // I serve this
  const peer = await FallNet.find('fallmap');        // who else does?
  FallNet.send(peer.id, { hello: 'world' });
  FallNet.onMessage(msg => console.log(msg));
</script>
```

## Why

The defensive stack's final layer · when CDNs/hosts/firewalls all fail, operators serve each other directly via WebRTC. STUN bypasses NAT. Manual offer/answer bypasses signaling servers.

## License

MIT · ◊·κ=1

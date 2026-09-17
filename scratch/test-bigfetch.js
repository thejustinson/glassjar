// The cursor= param gives distinct pages but only 1 page back (cursor = last sig of page 1 gives page 2, cursor = last sig of page 2 gives same page 2)
// Let me test if the Cookiescan token activity endpoint supports a limit that's high enough to get all txs

async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // Get a large batch
  const r1 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=50');
  const d1 = await r1.json();
  const txs = d1.transactions || [];
  console.log('Limit 50 result:', txs.length, 'total txs (unique sigs):', new Set(txs.map(function(t) { return t.signature; })).size);
  
  // What about the cursor pagination - page 2 from page 1:
  const cursor = txs[txs.length - 1].signature;
  const r2 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=50&cursor=' + cursor);
  const d2 = await r2.json();
  const txs2 = d2.transactions || [];
  const p1Set = new Set(txs.map(function(t) { return t.signature; }));
  const newTxs = txs2.filter(function(t) { return !p1Set.has(t.signature); });
  console.log('Page 2 (cursor from page1 last):', txs2.length, 'new (not in p1):', newTxs.length);
  
  // How about the Cookiescan API transactions endpoint returns new data each time we call it (live chain)
  // Maybe we should build a client-side accumulator
  
  // Check if /api/mainnet/transactions is the right endpoint for token filtering
  // vs the token-specific /transactions endpoint  
  const tokenTxs = await fetch('https://cookiescan.io/api/mainnet/token/' + mint + '/transactions?limit=50').then(function(r) { return r.json(); });
  console.log('token/transactions endpoint limit=50:', tokenTxs.length, 'unique sigs:', new Set(tokenTxs.map(function(t) { return t.signature; })).size);
  console.log('token/transactions[0]:', tokenTxs[0]);
  console.log('main txs[0]:', txs[0]);
}
test().catch(function(e) { console.error(e.message, e.stack); });

async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // Page 1
  const r1 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5');
  const d1 = await r1.json();
  const txs1 = d1.transactions || [];
  console.log('Page 1 sigs:', txs1.map(function(t) { return t.signature.slice(0, 8); }).join(', '));
  const cursor1 = txs1[txs1.length - 1].signature;
  
  // Page 2 using cursor
  const r2 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&cursor=' + cursor1);
  const d2 = await r2.json();
  const txs2 = d2.transactions || [];
  console.log('Page 2 sigs:', txs2.map(function(t) { return t.signature.slice(0, 8); }).join(', '));
  const cursor2 = txs2[txs2.length - 1].signature;
  
  // Page 3 using cursor from page 2 (page 3 == page 2, so cursor-based with last item repeats)
  // Let's try with afterSignature instead
  const r3 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&after=' + cursor1);
  const d3 = await r3.json();
  const txs3 = d3.transactions || [];
  console.log('after= page 2:', txs3.map(function(t) { return t.signature.slice(0, 8); }).join(', '));
  
  // Try afterSlot
  const slot1 = txs1[txs1.length - 1].slot;
  const r4 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&afterSlot=' + slot1);
  const d4 = await r4.json();
  const txs4 = d4.transactions || [];
  console.log('afterSlot page 2:', txs4.map(function(t) { return t.signature.slice(0, 8); }).join(', '));

  // Try beforeBlockHeight
  const bh1 = txs1[txs1.length - 1].blockHeight;
  const r5 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&beforeBlockHeight=' + bh1);
  const d5 = await r5.json();
  const txs5 = d5.transactions || [];
  console.log('beforeBlockHeight page 2:', txs5.map(function(t) { return t.signature.slice(0, 8); }).join(', '));
  console.log('Are page 2 sigs different from page 1?', !txs5.some(function(t) { return txs1.some(function(t1) { return t1.signature === t.signature; }); }));
}
test().catch(function(e) { console.error(e.message); });

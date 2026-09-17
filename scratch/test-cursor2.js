async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // Page 1
  const r1 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5');
  const d1 = await r1.json();
  const txs1 = d1.transactions || [];
  console.log('Page 1:', txs1.length, 'sigs:', txs1.map(function(t) { return t.signature.slice(0, 8); }).join(', '));
  console.log('P1 timestamps:', txs1.map(function(t) { return t.timestamp; }).join(', '));
  
  const cursor1 = txs1[txs1.length - 1].signature;
  
  // Page 2
  const r2 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&cursor=' + cursor1);
  const d2 = await r2.json();
  const txs2 = d2.transactions || [];
  console.log('Page 2:', txs2.length, 'sigs:', txs2.map(function(t) { return t.signature.slice(0, 8); }).join(', '));
  
  // Are page 2 sigs different from page 1?
  const p1sigs = new Set(txs1.map(function(t) { return t.signature; }));
  const overlap = txs2.filter(function(t) { return p1sigs.has(t.signature); });
  console.log('Overlap between p1 and p2:', overlap.length, 'items (should be 0 for proper pagination)');
  
  // Page 3
  const cursor2 = txs2[txs2.length - 1].signature;
  const r3 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&cursor=' + cursor2);
  const d3 = await r3.json();
  const txs3 = d3.transactions || [];
  console.log('Page 3:', txs3.length, 'sigs:', txs3.map(function(t) { return t.signature.slice(0, 8); }).join(', '));
}
test().catch(function(e) { console.error(e.message); });

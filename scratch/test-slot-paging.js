async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // Fetch page 1 with limit=25
  const r1 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=25');
  const d1 = await r1.json();
  const txs = d1.transactions || [];
  const p1Sigs = txs.map(function(t) { return t.signature; });
  console.log('Page 1 count:', txs.length);
  console.log('First ts:', txs[0].timestamp, 'Last ts:', txs[txs.length-1].timestamp);
  console.log('First slot:', txs[0].slot, 'Last slot:', txs[txs.length-1].slot);
  
  const lastSlot = txs[txs.length-1].slot;
  const lastTs = txs[txs.length-1].timestamp;
  
  // Try beforeSlot with actual slot number (not param name)
  const r2 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=25&maxSlot=' + (lastSlot - 1));
  const d2 = await r2.json();
  const txs2 = d2.transactions || [];
  const new2 = txs2.filter(function(t) { return !p1Sigs.includes(t.signature); });
  console.log('maxSlot page 2: total', txs2.length, 'new:', new2.length);
  
  // Try beforeSlot
  const r3 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=25&beforeSlot=' + lastSlot);
  const d3 = await r3.json();
  const txs3 = d3.transactions || [];
  const new3 = txs3.filter(function(t) { return !p1Sigs.includes(t.signature); });
  console.log('beforeSlot page 2: total', txs3.length, 'new:', new3.length);
  
  // Try endSlot
  const r4 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=25&endSlot=' + lastSlot);
  const d4 = await r4.json();
  const txs4 = d4.transactions || [];
  const new4 = txs4.filter(function(t) { return !p1Sigs.includes(t.signature); });
  console.log('endSlot page 2: total', txs4.length, 'new:', new4.length);
  
  // Try toSlot
  const r5 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=25&toSlot=' + (lastSlot - 1));
  const d5 = await r5.json();
  const txs5 = d5.transactions || [];
  const new5 = txs5.filter(function(t) { return !p1Sigs.includes(t.signature); });
  console.log('toSlot page 2: total', txs5.length, 'new:', new5.length);
}
test().catch(function(e) { console.error(e.message); });

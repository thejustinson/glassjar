async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // Verify beforeSlot pagination works correctly
  const r1 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=10');
  const d1 = await r1.json();
  const txs1 = d1.transactions || [];
  const p1Sigs = new Set(txs1.map(function(t) { return t.signature; }));
  const lastSlot = txs1[txs1.length-1].slot;
  console.log('Page 1:', txs1.length, 'txs, slot range:', txs1[0].slot, '->', lastSlot);
  
  const r2 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=10&beforeSlot=' + lastSlot);
  const d2 = await r2.json();
  const txs2 = d2.transactions || [];
  const new2 = txs2.filter(function(t) { return !p1Sigs.has(t.signature); });
  console.log('Page 2 (beforeSlot=' + lastSlot + '):', txs2.length, 'txs,', new2.length, 'new, slot range:', txs2[0] && txs2[0].slot, '->', txs2[txs2.length-1] && txs2[txs2.length-1].slot);
  
  // Page 3
  if (txs2.length > 0) {
    const lastSlot2 = txs2[txs2.length-1].slot;
    const p2Sigs = new Set(txs2.map(function(t) { return t.signature; }));
    const r3 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=10&beforeSlot=' + lastSlot2);
    const d3 = await r3.json();
    const txs3 = d3.transactions || [];
    const new3 = txs3.filter(function(t) { return !p1Sigs.has(t.signature) && !p2Sigs.has(t.signature); });
    console.log('Page 3 (beforeSlot=' + lastSlot2 + '):', txs3.length, 'txs,', new3.length, 'truly new, slot range:', txs3[0] && txs3[0].slot, '->', txs3[txs3.length-1] && txs3[txs3.length-1].slot);
  }
  
  // Key test: do accounts in the full txs have full public keys?
  console.log('Accounts on tx[0]:', txs1[0].accounts.slice(0, 2));
  console.log('feePayer (accounts[0]):', txs1[0].accounts[0]);
}
test().catch(function(e) { console.error(e.message); });

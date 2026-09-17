async function test() {
  // main-txs-filter has the rich data with timestamp. Let's look at it more carefully
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // Full transaction list with token param - has blockHeight, slot, timestamp
  const r = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=25');
  const d = await r.json();
  console.log('Total txs from /transactions?token=:', d.transactions.length, '(meta count):', d.count, d.total);
  console.log('First tx timestamp:', d.transactions[0].timestamp, 'sig:', d.transactions[0].signature);
  console.log('All keys:', Object.keys(d.transactions[0]).join(', '));
  
  // Now check with before param for pagination
  const lastSig = d.transactions[d.transactions.length - 1].signature;
  const r2 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=25&before=' + lastSig);
  const d2 = await r2.json();
  console.log('After before= txs count:', d2.transactions.length, 'first sig:', d2.transactions[0]?.signature?.slice(0, 20));
}
test().catch(e => console.error(e.message));

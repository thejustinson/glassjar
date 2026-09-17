async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // Test if cursor-based pagination works  
  const r1 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5');
  const d1 = await r1.json();
  const sigs1 = d1.transactions.map(t => t.signature.slice(0, 12));
  const lastSig = d1.transactions[d1.transactions.length - 1].signature;
  const lastTs = d1.transactions[d1.transactions.length - 1].timestamp;
  console.log('Page 1 sigs:', sigs1.join(', '));
  console.log('Last sig:', lastSig, 'ts:', lastTs);
  
  // Try before=<timestamp>
  const r2a = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&before=' + lastTs);
  const d2a = await r2a.json();
  console.log('Before timestamp page 2 sigs:', d2a.transactions.map(t => t.signature.slice(0, 12)).join(', '));
  
  // Try beforeSlot
  const lastSlot = d1.transactions[d1.transactions.length - 1].slot;
  const r2b = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&beforeSlot=' + lastSlot);
  const d2b = await r2b.json();
  console.log('Before slot page 2 sigs:', d2b.transactions.map(t => t.signature.slice(0, 12)).join(', '));
  
  // Try beforeSignature (no - not before signature)
  const r2c = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&cursor=' + lastSig);
  const d2c = await r2c.json();
  console.log('cursor= page 2 sigs:', d2c.transactions.map(t => t.signature.slice(0, 12)).join(', '));
}
test().catch(e => console.error(e.message));

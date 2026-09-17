// beforeSlot gives same page — this endpoint returns LATEST 25 txs always regardless of beforeSlot
// The reason page 2 has 12 new is that data was live-updating between calls

// The Cookiescan token/transactions endpoint only returns 5 items max (the last 5)
// The main /transactions endpoint only returns recent data (always latest N)

// Let's test if there's a way to get older transactions
// - Try getting tx detail for the oldest sig from page 1, then check slot and query before that slot
async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // Get page 1
  const r1 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5');
  const d1 = await r1.json();
  const txs1 = d1.transactions || [];
  const newestSig = txs1[0].signature;
  const newestSlot = txs1[0].slot;
  console.log('Newest sig:', newestSig, 'slot:', newestSlot);
  
  // Wait 2 seconds and get again
  await new Promise(function(r) { setTimeout(r, 2000); });
  const r2 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5');
  const d2 = await r2.json();
  const txs2 = d2.transactions || [];
  const newestSig2 = txs2[0].signature;
  console.log('2s later - newest sig:', newestSig2, 'slot:', txs2[0].slot);
  console.log('Same?', newestSig === newestSig2);
  
  // Try with min/max timestamp
  const oldest = txs1[txs1.length-1].timestamp;
  const r3 = await fetch('https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5&endTime=' + oldest);
  const d3 = await r3.json();
  const txs3 = d3.transactions || [];
  console.log('endTime oldest page 2:', txs3.length);
}
test().catch(function(e) { console.error(e.message); });

async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  
  // cursor= works! Let's paginate multiple pages
  let cursor = null;
  let totalFetched = 0;
  let page = 0;
  
  while (page < 5) {
    const url = 'https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=5' + (cursor ? '&cursor=' + cursor : '');
    const r = await fetch(url);
    const d = await r.json();
    const txs = d.transactions || [];
    if (txs.length === 0) {
      console.log('No more pages at page', page + 1);
      break;
    }
    totalFetched += txs.length;
    console.log('Page', page + 1, ':', txs.length, 'txs, sigs:', txs.map(t => t.signature.slice(0, 8)).join(', '));
    console.log('  timestamps:', txs.map(t => t.timestamp).join(', '));
    cursor = txs[txs.length - 1].signature;
    page++;
    
    // Check the response shape for nextCursor or pagination tokens
    const nonTxKeys = Object.keys(d).filter(k => k !== 'transactions');
    if (nonTxKeys.length > 0) {
      console.log('  extra response keys:', nonTxKeys, JSON.stringify(Object.fromEntries(nonTxKeys.map(k => [k, d[k]]))).slice(0, 200));
    }
  }
  console.log('Total fetched:', totalFetched);
}
test().catch(e => console.error(e.message));

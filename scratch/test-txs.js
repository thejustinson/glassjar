async function test() {
  const mint = 'RXQMiYt4hoB5YbLm2ZBWRrSJRirdACgKEmwsGRPcnkN';
  const tests = [
    { url: 'https://cookiescan.io/api/mainnet/token/' + mint + '/transactions?limit=100', name: 'token-txs-100' },
    { url: 'https://cookiescan.io/api/mainnet/transactions?token=' + mint + '&limit=25', name: 'main-txs-filter' },
    { url: 'https://cookiescan.io/api/mainnet/account/' + mint + '/transactions', name: 'account-txs' },
    { url: 'https://cookiescan.io/api/mainnet/account/' + mint + '/transfers', name: 'account-transfers' },
  ];
  for (const t of tests) {
    const r = await fetch(t.url);
    console.log(t.name, '->', r.status);
    if (r.ok) {
      const d = await r.json();
      const items = Array.isArray(d) ? d : (d.transactions || []);
      console.log('  count:', items.length);
      if (items.length > 0) {
        console.log('  first item keys:', Object.keys(items[0]).join(', '));
      }
    }
  }
}
test().catch(e => console.error(e.message));

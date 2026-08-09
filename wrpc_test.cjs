// wrpc_test.cjs — verify wRPC resolver + connection for testnet-10
// Run from project root (uses installed node_modules copy).
(async () => {
  try {
    const lib = require('@kcoin/kaspa-web3.js');
    const { RpcClient, Resolver, NetworkId } = lib;
    console.log('lib loaded. exports ok:', !!RpcClient, !!Resolver, !!NetworkId);
    const rpc = new RpcClient({ resolver: new Resolver(), networkId: NetworkId.Testnet10 });
    console.log('connecting via resolver (testnet-10)...');
    const t0 = Date.now();
    await rpc.connect();
    console.log('CONNECTED in', Date.now() - t0, 'ms');
    const info = await rpc.getServerInfo();
    console.log('server info:', JSON.stringify(info).slice(0, 300));
    const dag = await rpc.getBlockDagInfo();
    console.log('network:', dag.networkName || dag.network, '| daa:', dag.virtualDaaScore);
    const c = rpc;
    (c.dispose || c.disconnect || (() => {})).call(c);
    console.log('OK — wRPC path viable.');
  } catch (e) {
    console.error('WRPC TEST FAILED:', e && e.message || e);
    if (e && e.stack) console.error(e.stack.split('\n').slice(0, 5).join('\n'));
  }
  process.exit(0);
})();

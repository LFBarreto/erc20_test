/**
 * This file contains all function helper we provide to simplify the exercice.
 * Please fully study what the functions are doing and feel free to modify it in your own projects.
 * Feel free to add more feature if needed.
 */

const isValidEthereum = address => /^[0-9a-fA-F]{40}$/.test(address)

const fetchAddressBalance = address => {
  const url = `http://eth-mainnet.explorers.prod.aws.ledger.fr/blockchain/v3/addresses/${address}/balance`;

  return fetch(url).then(async r => {
    if (!r.ok) {
      const res = await r.text();
      throw res;
    }
    return r.json();
  });
}

const fetchCounterValues = (tokens = []) => {
  const url = `https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=${tokens.filter((t) => t !== 'ETH').join(',')},ETH,USD,EUR&api_key=33ed10fbe4785c254dc96fadbe796d26424a2fd367f69e673fb467d3b0d8ec89`

  return fetch(url).then(async r => {
    if (!r.ok) {
      const res = await r.text();
      throw res;
    }
    return r.json();
  });
}

const fetchTxsPage = (address, block, batchSize = 25) => {
  const url = `http://eth-mainnet.explorers.prod.aws.ledger.fr/blockchain/v3/addresses/${address}/transactions?batch_size=${batchSize}&no_token=true${
    block ? "&block_hash=" + block : ""
  }`;
  // console.log("GET", url);
  return fetch(url).then(async r => {
    if (!r.ok) {
      const res = await r.text();
      throw res;
    }
    return r.json();
  });
};
/**
 * fetchTxs allows to retrieve all transactions of an Ethereum address with Ledger's API
 * It takes an ethereum address and returns a Promise of an array of transactions (from the blockchain).
 *
 * Feel free to play with it beforehand and look at the returned value objects.
 */
const fetchTxs = async address => {

  console.log(`fetching txs for ${address}`);
  let { txs } = await fetchTxsPage(address);
  while (true) {
    const last = txs[txs.length - 1];
    if (!last) break;
    const { block } = last;
    if (!block) break;
    const next = await fetchTxsPage(address, block.hash);
    const nextTxs = next.txs.filter(tx => !txs.some(t => t.hash === tx.hash));
    if (nextTxs.length === 0) break;
    txs = txs.concat(nextTxs);
  }
  txs.reverse();
  console.log(`finished fetching ${txs.length} txs for ${address}`);
  return txs;
};

/**
 * txsToOperations takes the retrieved array of transactions
 * and transform it to an array of operations.
 *
 * NB: a blockchain transaction can produce multiple operations.
 * Not only a "SELF" transaction produces 2 moves but also, with ERC20,
 * we in fact can have many token operations in one transaction.
 *
 * Please study the function below and test it with different transactions.
 */
const txsToOperations = (txs, address) => {
  const ops = [];
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    const fee = tx.gas_price * tx.gas_used;
    const sending = address === tx.from;
    const receiving = address === tx.to;
    const value = tx.value;

    if (sending) {
      ops.push({
        symbol: "ETH",
        magnitude: 18,
        id: `${tx.hash}-OUT`,
        hash: tx.hash,
        type: "OUT",
        value: value + fee,
        address: tx.to,
        date: new Date(tx.received_at)
      });
    }
    if (receiving) {
      ops.push({
        symbol: "ETH",
        magnitude: 18,
        id: `${tx.hash}-IN`,
        hash: tx.hash,
        type: "IN",
        value,
        address: tx.from,
        date: new Date(tx.received_at)
      });
    }
    const transfers = tx.transfer_events.list;
    for (let j = 0; j < transfers.length; j++) {
      const event = transfers[j];
      if (event.symbol) {
        const symbol = event.symbol.match(/([^ ]+)/g)[0];
        const sending = address === event.from;
        const receiving = address === event.to;
        const value = event.count;
        if (sending) {
          ops.push({
            symbol,
            magnitude: event.decimal,
            id: `${tx.hash}-${j}-OUT`,
            hash: tx.hash,
            type: "OUT",
            value,
            address: event.to,
            date: new Date(tx.received_at)
          });
        }
        if (receiving) {
          ops.push({
            symbol,
            magnitude: event.decimal,
            id: `${tx.hash}-${j}-IN`,
            hash: tx.hash,
            type: "IN",
            value,
            address: event.from,
            date: new Date(tx.received_at)
          });
        }
      }
    }
  }
  return ops;
};

/**
 * This is an example to calculate the balance.
 * You might want to diverge from it to add more feature!
 *
 * It takes an array of operations and calculates balances of ETH and ERC20
 * as well as other information.
 *
 * Feel free to play with it.
 */
const getSummary_example = operations => {
  const tokensMagnitude = {};
  const balances = {};
  operations.forEach(op => {
    balances[op.symbol] =
      (balances[op.symbol] || 0) + (op.type === "OUT" ? -op.value : op.value);
    tokensMagnitude[op.symbol] = op.magnitude;
  });
  return { balances, tokensMagnitude };
};

/**
 * formatValue will returns a string that is human readable for a cryptocurrency amount.
 * Example: formatValue(100000, 8) is 0.001 (because 100000 satoshis is 0.001 btc)
 *
 * - value is an amount in cryptocurrencies smallest unit (e.g. the satoshi / the wei)
 * - magnitude is the number of digits that the coin supports
 */
const formatValue = (value, magnitude = 18) =>
  (value / Math.pow(10, magnitude));

export default {
  isValidEthereum,
  fetchAddressBalance,
  fetchTxsPage,
  fetchTxs,
  txsToOperations,
  getSummary_example,
  formatValue,
  fetchCounterValues
};
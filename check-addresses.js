const fs = require('fs');
const request = require('request-promise');
const utils = require('./utils')
const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const SATS_PER_BTC = 100000000.0

const checkAddressInfo = async (address) => {
  const response = await request(`${apiBase}/address/${address}`);
  return JSON.parse(response).address;
}

const getKeysFromFilename = (filename) => {
  return fs.readFileSync(filename).toString().split('\n')
}

const checkKeys = async (keys) => {
  const addressObjects = keys.map(it => utils.hexToAddresses(it, network));
  let allSpendableUtxos = []
  for (let i = 0; i < addressObjects.length; i++) {
    const addressObject = addressObjects[i]
    console.log(`\nChecking private key at position ${i}:`)
    for (type of ['p2pkhCompressed', 'p2pkhUncompressed']) {
      const address = addressObject[type]
      const info = await checkAddressInfo(address);
      const balance = info.total.balance_int
      if (balance > 0) {
        console.log(`~~~~~ Success! Balance ${balance / SATS_PER_BTC} btc found for ${address} ~~~~~`)
        const spendableUtxos = await utils.getSpendableUtxos(address, info.transactions, apiBase)
        for (const utxo of spendableUtxos) {
          utxo.prvKeyIndex = i
          utxo.addressType = type
        }
        allSpendableUtxos = allSpendableUtxos.concat(spendableUtxos)
      } else {
        console.log(`No balance found for ${address}. Total received: ${info.total.received_int / SATS_PER_BTC}. Total spent: ${info.total.spent_int / SATS_PER_BTC}`)
      }
    }
  }
  return allSpendableUtxos
}

const parseArguments = () => {
  if (process.argv[3] === 'mainnet') {
    console.log(`\nUsing mainnet...`)
    network = bitcoin.networks.bitcoin
    apiBase = 'https://api.smartbit.com.au/v1/blockchain';
  } else {
    console.log(`\nUsing testnet...`)
    network = bitcoin.networks.testnet
    apiBase = 'https://testnet-api.smartbit.com.au/v1/blockchain';
  }
}

const hashKeys = (keys) => {
  return keys.map(it => 
    crypto.createHash('sha256').update(it).digest('hex')
  )
}

let network, apiBase
async function go() {
  parseArguments()
  let keys = getKeysFromFilename(process.argv[2])
  if (process.env.HASH_KEYS) {
    console.log('Hashing the keys...')
    keys = hashKeys(keys)
  }
  const spendableUtxos = await checkKeys(keys)
  if (spendableUtxos.length === 0) {
    console.log(`\n\nNo spendable utxos to recover.\n\n`)
    return
  }
  const totalBtc = spendableUtxos.map(it => it.satoshis).reduce((a,b) => a + b) / SATS_PER_BTC
  console.log(`\n\nTotal recovery amount: ${totalBtc} btc\n\n`)
}

go()

"use strict";

const ccxt      = require ('../../ccxt.js')
const asTable   = require ('as-table')
const log       = require ('ololog').configure ({ locate: false })

require ('ansicolor').nice;

//-----------------------------------------------------------------------------

// this script loads markets from all exchanges
// if it cannot connect to an exchange, it falls back to an alternative route via proxy
// it will retry to load a exchange until it either reaches the exchange or runs out of proxies

//-----------------------------------------------------------------------------

process.on ('uncaughtException',  e => { log.bright.red.error (e); process.exit (1) })
process.on ('unhandledRejection', e => { log.bright.red.error (e); process.exit (1) })

//-----------------------------------------------------------------------------

let loadExchange = async exchange => {
    await exchange.loadMarkets ()
    log (exchange.id.green, 'loaded', 
        exchange.symbols.length.toString ().bright.green, 'symbols', 
        (exchange.proxy ? exchange.proxy : '_').blue)
}

//-----------------------------------------------------------------------------

let tryAllProxies = async function (exchange, proxies) {

    let currentProxy = 0
    let maxRetries   = proxies.length

    // a special case for ccex
    if (exchange.id == 'ccex')
        currentProxy = 1
    
    for (let numRetries = 0; numRetries < maxRetries; numRetries++) {

        try {

            exchange.proxy = proxies[currentProxy]
            await loadExchange (exchange)
            break

        } catch (e) {

            currentProxy = ++currentProxy % proxies.length
            if (e instanceof ccxt.DDoSProtectionError) {
                log.bright.yellow (exchange.id, '[DDoS Protection Error] ' + e.message)
            } else if (e instanceof ccxt.TimeoutError) {
                log.bright.yellow (exchange.id, '[Timeout Error] ' + e.message)
            } else if (e instanceof ccxt.AuthenticationError) {
                log.bright.yellow (exchange.id, '[Authentication Error] ' + e.message)
            } else if (e instanceof ccxt.ExchangeNotAvailableError) {
                log.bright.yellow (exchange.id, '[Exchange Not Available Error] ' + e.message)
            } else if (e instanceof ccxt.EndpointNotAvailableError) {
                log.bright.yellow (exchange.id, '[Endpoint Not Available Error] ' + e.message)
            } else {
                throw e;
            }
        }

    }
}

//-----------------------------------------------------------------------------

let proxies = [
    '',
    'https://cors-anywhere.herokuapp.com/',
    'https://crossorigin.me/',
]

let exchanges = []

async function main () {
    // instantiate all exchanges
    await Promise.all (ccxt.exchanges.map (async id => {
        let exchange = new (ccxt)[id] ()
        exchanges.push (exchange)
        await tryAllProxies (exchange, proxies)
    }))

    let succeeded = exchanges.filter (exchange => exchange.markets ? true : false).length .toString ().bright.green
    let failed = exchanges.filter (exchange => exchange.markets ? false : true).length
    let total = ccxt.exchanges.length.toString ().bright.white
    console.log (succeeded, 'of', total, 'exchanges loaded', ('(' + failed + ' errors)').red)
}

main ()

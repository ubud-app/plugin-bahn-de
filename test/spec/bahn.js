'use strict';

const Bahn = require('../../lib/bahn');

describe('Bahn', function () {
    this.timeout(120000);

    it('should fetch orders', async function () {
        const bahn = new Bahn(process.env.BAHN_USER, process.env.BAHN_PASSWORD);
        const orders = await bahn.getOrders(process.env.BAHN_ORDERS.split(','));
        const json = JSON.stringify(orders, null, '  ');

        process.env.BAHN_FIND.split(',').forEach(find => {
            if(json.indexOf(find) === -1) {
                throw new Error('Unable to find `' + find + '` in result: ' + json);
            }
        });
    });
});
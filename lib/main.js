'use strict';

const PluginTools = module.parent.exports;
const BahnDE = require('./bahn');


new PluginTools.Config({
    id: 'username',
    type: 'text',
    label: 'plugins.label.username'
});
new PluginTools.Config({
    id: 'password',
    type: 'password',
    label: 'plugins.label.password'
});


module.exports = class {
    /**
     * @throws {PluginTools.ConfigurationError|PluginTools.ConfigurationErrors}
     * @returns {Promise.<void>}
     */
    static async validateConfig() {
        if(!PluginTools.config('username')) {
            throw new PluginTools.ConfigurationError({
                field: 'username',
                code: 'empty'
            });
        }
        if(!PluginTools.config('password')) {
            throw new PluginTools.ConfigurationError({
                field: 'password',
                code: 'empty'
            });
        }

        const bahn = new BahnDE(PluginTools.config('username'), PluginTools.config('password'));

        try {
            await bahn.login();
        }
        catch(err) {
            console.log(err);

            throw new PluginTools.ConfigurationErrors([
                {
                    field: 'username',
                    code: 'invalid'
                },
                {
                    field: 'password',
                    code: 'invalid'
                }
            ]);
        }
    }

    /**
     * @returns {Promise.<PluginTools.Metadata[]>}
     */
    static async getMetadata(transaction) {
        const bahn = new BahnDE(PluginTools.config('username'), PluginTools.config('password'));
        const orderIds = (transaction.memo || '').match(/([0-9A-Z]{10})/g) || [];
        const items = await bahn.getOrders(orderIds);

        if(items.length === 1 && items[0].price === (transaction.amount * -1)) {
            return [
                new PluginTools.Memo(items[0].description)
            ];
        }else{
            let sum = 0;
            const splits = items.map(item => {
                sum += item.price;

                return new PluginTools.Unit({
                    amount: item.price * -1,
                    memo: item.description
                });
            });

            if(sum !== (transaction.amount * -1)) {
                splits.push(new PluginTools.Unit({
                    amount: (transaction.amount - sum) * -1,
                    memo: ''
                }));
            }

            return [
                new PluginTools.Split(splits),
                new PluginTools.Memo(items.length + ' Fahrkarten')
            ];
        }
    }
};
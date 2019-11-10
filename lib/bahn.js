'use strict';

const phantomPrebuilt = require('phantomjs-prebuilt');
const driver = require('promise-phantom');
const EventEmitter = require('events');
const fs = require('fs');

const debug = 1;
const debugStart = new Date().getTime();
let debugCounter = 0;

if (debug && !fs.existsSync(__dirname + '/../debug')) {
    fs.mkdirSync(__dirname + '/../debug');
}

module.exports = class BahnDE extends EventEmitter {
    constructor (username, password) {
        super();

        this.username = username;
        this.password = password;
    }

    async auth () {
        this.phantom = await driver.create({path: phantomPrebuilt.path});
        const page = await this.phantom.createPage();

        page.set('settings.userAgent', 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36');
        page.set('settings.javascriptEnabled', true);
        page.set('settings.loadImages', false);

        page.onLoadFinished(() => {
            this.emit('load', page);
        });
        page.onConsoleMessage(msg => {
            console.log('PhantomJS: >', msg);
        });

        this.phantom.cookiesEnabled = true;
        this.phantom.javascriptEnabled = true;

        await this.open(page, 'https://www.bahn.de/p/view/meinebahn/login.shtml');
        await page.set('viewportSize', {width: 1024, height: 600});

        page.evaluate(function (username, password) {
            document.querySelector('#inhalt input[name="username"]').value = username;
            document.querySelector('#inhalt input[type="password"]').value = password;
        }, this.username, this.password);

        await this.screenshot(page);

        await page.evaluate(function () {
            document.querySelector('form.login').submit();
        });

        await this.onLoad();
        await this.screenshot(page);

        const loggedIn = await page.evaluate(function () {
            return document.querySelectorAll('#opener-mletztebuchung').length >= 1;
        });
        if (!loggedIn) {
            throw new Error('Unable to login: Is username and password correct?');
        }

        console.log('Logged in!');
        return page;
    }

    async login () {
        try {
            await this.auth();
        }
        finally {
            this.phantom.exit();
        }
    }

    async getOrders (ids) {
        const page = await this.auth();
        const orders = [];

        await page.evaluate(function () {
            document.querySelector('p.letzteBuchungen a').click();
        });
        await this.onLoad();
        await this.screenshot(page);

        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        for (let i = 0; i < ids.length; i++) {
            orders.push(
                await this._getOrder(
                    page,
                    ids[i],
                    i === ids.length - 1
                )
            );
        }

        this.phantom.exit();
        return orders;
    }

    async _getOrder (page, id, lastOne) {
        page.evaluate(function (id) {
            document.querySelector('input[name="auftragsnr"]').value = id;
            document.querySelector('input[name="auftragsnr"]').onkeyup();
        }, id);

        await this.screenshot(page);

        await page.evaluate(function () {
            document.querySelector('button[title="Aktualisieren"]').click();
        });

        await this.onLoad();
        await this.screenshot(page);

        const result = await page.evaluate(function () {
            var items = [],
                rows = document.querySelectorAll('.opener-content table:nth-child(2) tbody tr'),
                i;

            for (i = 0; i < rows.length; i++) {
                var tr = rows[i];

                items.push({
                    description: (
                        tr.querySelector('td:nth-child(1)').innerHTML + ' vom ' +
                        tr.querySelector('td:nth-child(2)').innerHTML.split('.', 2).join('.') + ': ' +
                        tr.querySelector('td:nth-child(3)').innerHTML
                    ),
                    price: parseInt(tr.querySelector('td:last-child').innerHTML.split(' ')[0].replace(',', ''), 10)
                });
            }

            return items;
        });

        if (!lastOne) {
            await page.evaluate(function () {
                document.querySelector('form[name="formularBackButton"] button[type="submit"]').click();
            });

            await this.onLoad();
            await this.screenshot(page);
        }

        result.id = id;
        return result;
    }

    async open (page, url) {
        console.log('Loading %s', url);
        const status = await page.open(url);
        if (status !== 'success') {
            console.log('Loading %s failed, retry in 10 seconds', url);
            return new Promise(cb => {
                setTimeout(() => {
                    console.log('Retry loading %s', url);
                    cb(this.open(page, url));
                }, 10000);
            });
        }

        await this.screenshot(page);

        console.log('Loading %s [Ok]', url);
    }

    async onLoad () {
        return new Promise(cb => {
            this.once('load', page => {
                setTimeout(() => {
                    cb(page);
                }, 200);
            });
        });
    }

    async screenshot (page) {
        if (!debug) {
            return;
        }

        debugCounter += 1;
        page.render(__dirname + '/../debug/' + debugStart + '_' + debugCounter + '.png');
    }
};

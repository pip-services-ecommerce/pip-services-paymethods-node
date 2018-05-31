let _ = require('lodash');
let async = require('async');
let restify = require('restify');
let assert = require('chai').assert;

import { ConfigParams } from 'pip-services-commons-node';
import { Descriptor } from 'pip-services-commons-node';
import { References } from 'pip-services-commons-node';

import { CreditCardV1 } from '../../../src/data/version1/CreditCardV1';
import { CreditCardTypeV1 } from '../../../src/data/version1/CreditCardTypeV1';
import { CreditCardStateV1 } from '../../../src/data/version1/CreditCardStateV1';
import { CreditCardsMemoryPersistence } from '../../../src/persistence/CreditCardsMemoryPersistence';
import { CreditCardsController } from '../../../src/logic/CreditCardsController';
import { CreditCardsHttpServiceV1 } from '../../../src/services/version1/CreditCardsHttpServiceV1';

let httpConfig = ConfigParams.fromTuples(
    "connection.protocol", "http",
    "connection.host", "localhost",
    "connection.port", 3000
);

let CREDIT_CARD1: CreditCardV1 = {
    id: '1',
    customer_id: '1',
    type: CreditCardTypeV1.Visa,
    number: '1111111111111111',
    expire_month: 1,
    expire_year: 2021,
    first_name: 'Bill',
    last_name: 'Gates',
    billing_address: {
        line1: '2345 Swan Rd',
        city: 'Tucson',
        zip: '85710',
        country_code: 'US'
    },
    cvc: '213',
    name: 'Test Card 1',
    saved: true,
    default: true,
    state: CreditCardStateV1.Ok
};
let CREDIT_CARD2: CreditCardV1 = {
    id: '2',
    customer_id: '1',
    type: CreditCardTypeV1.Visa,
    number: '2222222222222222',
    expire_month: 4,
    expire_year: 2028,
    first_name: 'Joe',
    last_name: 'Dow',
    billing_address: {
        line1: '123 Broadway Blvd',
        city: 'New York',
        zip: '123001',
        country_code: 'US'
    },
    name: 'Test Card 2',
    saved: true,
    default: false,
    state: CreditCardStateV1.Expired
};


suite('CreditCardsHttpServiceV1', ()=> {    
    let service: CreditCardsHttpServiceV1;
    let rest: any;

    suiteSetup((done) => {
        let persistence = new CreditCardsMemoryPersistence();
        let controller = new CreditCardsController();

        service = new CreditCardsHttpServiceV1();
        service.configure(httpConfig);

        let references: References = References.fromTuples(
            new Descriptor('pip-services-creditcards', 'persistence', 'memory', 'default', '1.0'), persistence,
            new Descriptor('pip-services-creditcards', 'controller', 'default', 'default', '1.0'), controller,
            new Descriptor('pip-services-creditcards', 'service', 'http', 'default', '1.0'), service
        );
        controller.setReferences(references);
        service.setReferences(references);

        service.open(null, done);
    });
    
    suiteTeardown((done) => {
        service.close(null, done);
    });

    setup(() => {
        let url = 'http://localhost:3000';
        rest = restify.createJsonClient({ url: url, version: '*' });
    });
    
    
    test('CRUD Operations', (done) => {
        let creditCard1, creditCard2: CreditCardV1;

        async.series([
        // Create one credit card
            (callback) => {
                rest.post('/v1/credit_cards/create_credit_card',
                    {
                        card: CREDIT_CARD1
                    },
                    (err, req, res, creditCard) => {
                        assert.isNull(err);

                        assert.isObject(creditCard);
                        assert.equal(creditCard.number, CREDIT_CARD1.number);
                        assert.equal(creditCard.expire_year, CREDIT_CARD1.expire_year);
                        assert.equal(creditCard.customer_id, CREDIT_CARD1.customer_id);

                        creditCard1 = creditCard;

                        callback();
                    }
                );
            },
        // Create another credit card
            (callback) => {
                rest.post('/v1/credit_cards/create_credit_card', 
                    {
                        card: CREDIT_CARD2
                    },
                    (err, req, res, creditCard) => {
                        assert.isNull(err);

                        assert.isObject(creditCard);
                        assert.equal(creditCard.number, CREDIT_CARD2.number);
                        assert.equal(creditCard.expire_year, CREDIT_CARD2.expire_year);
                        assert.equal(creditCard.customer_id, CREDIT_CARD2.customer_id);

                        creditCard2 = creditCard;

                        callback();
                    }
                );
            },
        // Get all credit cards
            (callback) => {
                rest.post('/v1/credit_cards/get_credit_cards',
                    {},
                    (err, req, res, page) => {
                        assert.isNull(err);

                        assert.isObject(page);
                        assert.lengthOf(page.data, 2);

                        callback();
                    }
                );
            },
        // Update the credit card
            (callback) => {
                creditCard1.name = 'Updated Card 1';

                rest.post('/v1/credit_cards/update_credit_card',
                    { 
                        card: creditCard1
                    },
                    (err, req, res, creditCard) => {
                        assert.isNull(err);

                        assert.isObject(creditCard);
                        assert.equal(creditCard.name, 'Updated Card 1');
                        assert.equal(creditCard.id, CREDIT_CARD1.id);

                        creditCard1 = creditCard;

                        callback();
                    }
                );
            },
        // Delete credit card
            (callback) => {
                rest.post('/v1/credit_cards/delete_credit_card_by_id',
                    {
                        card_id: creditCard1.id,
                        customer_id: creditCard1.customer_id
                    },
                    (err, req, res, result) => {
                        assert.isNull(err);

                        //assert.isNull(result);

                        callback();
                    }
                );
            },
        // Try to get delete credit card
            (callback) => {
                rest.post('/v1/credit_cards/get_credit_card_by_id',
                    {
                        card_id: creditCard1.id,
                        customer_id: creditCard1.customer_id
                    },
                    (err, req, res, result) => {
                        assert.isNull(err);

                        //assert.isNull(result);

                        callback();
                    }
                );
            }
        ], done);
    });
});
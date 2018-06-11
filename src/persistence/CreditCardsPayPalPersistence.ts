let _ = require('lodash');
let async = require('async');

import { FilterParams } from 'pip-services-commons-node';
import { PagingParams } from 'pip-services-commons-node';
import { DataPage } from 'pip-services-commons-node';
import { ConfigParams } from 'pip-services-commons-node';
import { IConfigurable } from 'pip-services-commons-node';
import { IReferences } from 'pip-services-commons-node';
import { IReferenceable } from 'pip-services-commons-node';
import { IOpenable } from 'pip-services-commons-node';
import { ICleanable } from 'pip-services-commons-node';
import { CredentialParams } from 'pip-services-commons-node';
import { CredentialResolver } from 'pip-services-commons-node';
import { CompositeLogger } from 'pip-services-commons-node';

import { CreditCardV1 } from '../data/version1/CreditCardV1';
import { CreditCardTypeV1 } from '../data/version1/CreditCardTypeV1';
import { ICreditCardsPersistence } from './ICreditCardsPersistence'

export class CreditCardsPayPalPersistence implements ICreditCardsPersistence, IConfigurable,
    IReferenceable, IOpenable, ICleanable {

    private _sandbox: boolean = false;
    private _credentialsResolver: CredentialResolver = new CredentialResolver();
    private _logger: CompositeLogger = new CompositeLogger();
    private _client: any = null;

    public constructor() {}

    public configure(config: ConfigParams): void {
        this._logger.configure(config);
        this._credentialsResolver.configure(config);

        this._sandbox = config.getAsBooleanWithDefault("options.sandbox", this._sandbox);
    }

    public setReferences(references: IReferences): void {
        this._logger.setReferences(references);
        this._credentialsResolver.setReferences(references);
    }

    public isOpened(): boolean {
        return this._client != null;
    }

    public open(correlationId: string, callback: (err: any) => void): void {
        let credentials: CredentialParams;

        async.series([
            // Get credential params
            (callback) => {
                this._credentialsResolver.lookup(correlationId, (err, result) => {
                    credentials = result;
                    callback(err);
                });
            },
            // Connect
            (callback) => {
                this._client = require('paypal-rest-sdk');
                this._client.configure({
                    mode: this._sandbox ? 'sandbox' : 'live',
                    client_id: credentials.getAccessId(),
                    client_secret: credentials.getAccessKey()
                });
                callback();
            }
        ], callback);
    }

    public close(correlationId: string, callback: (err: any) => void): void {
        this._client = null;
        if (callback) callback(null);
    }

    private toPublic(value: any): CreditCardV1 {
        if (value == null) return null;

        let result = _.omit(value, 'external_customer_id', 'external_card_id',
            'external_card_id', 'valid_until', 'create_time', 'update_time', 'links');
        result.customer_id = value.external_customer_id;

        // Parse external_card_id
        let temp = value.external_card_id.split(';');
        result.number = temp.length > 0 ? temp[0] : '';
        result.name = temp.length > 1 ? temp[1] : '';
        result.ccv = temp.length > 2 ? temp[2] : '';
        result.saved = temp.length > 3 ? temp[3] == 'saved' : false;
        result.default = temp.length > 4 ? temp[4] == 'default' : false;

        return result;
    }

    private fromPublic(value: CreditCardV1): any {
        if (value == null) return null;

        let result = _.omit(value, 'id', 'state', 'customer_id', 'ccv', 'name', 'saved', 'default');
        result.external_customer_id = value.customer_id;

        // Generate external_card_id
        let temp = value.number;
        temp += ';' + (value.name ? value.name.replace(';', '_') : '');
        temp += ';' + (value.ccv ? value.ccv.replace(';', '')  : '');
        temp += ';' + (value.saved ? 'saved' : '');
        temp += ';' + (value.default ? 'default' : '');
        result.external_card_id = temp;

        return result;
    }

    public getPageByFilter(correlationId: string, filter: FilterParams, paging: PagingParams,
        callback: (err: any, page: DataPage<CreditCardV1>) => void): void {
        let id = filter.getAsNullableString('id');
        let state = filter.getAsNullableString('state');
        let customerId = filter.getAsNullableString('customer_id');
        let saved = filter.getAsNullableBoolean('saved');
        let ids = filter.getAsObject('ids');

        // Process ids filter
        if (_.isString(ids))
            ids = ids.split(',');
        if (!_.isArray(ids))
            ids = null;

        let skip = paging.getSkip(0);
        let take = paging.getTake(100);
        let items: CreditCardV1[] = [];

        let page = 0;
        let pageSize = 20;
        let pageItems: CreditCardV1[];

        async.doWhilst(
            (callback) => {
                page++;

                // Set filters supported by PayPal
                let options: any = {
                    page: page,
                    page_size: pageSize
                };
                if (customerId)
                    options.external_customer_id = customerId;

                 this._client.creditCard.list(options, (err, data) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    pageItems = _.map(data.items, (item) => this.toPublic(item));

                    for (let item of pageItems) {
                        // Filter items
                        if (id != null && item.id != id)
                            continue;
                        if (state != null && item.state != state)
                            continue;
                        if (saved != null && item.saved != saved)
                            continue;
                        if (ids != null && _.indexOf(ids, item.id) < 0)
                            continue;

                        // Process skip and take
                        if (skip > 0) {
                            skip--;
                            continue;
                        }

                        if (items.length < take)
                            items.push(item);
                    }

                    callback(null);
                });
            },
            () => pageItems.length == pageSize && items.length < take,
            (err) => {
                let page = err == null ? new DataPage(items) : null;
                callback(err, page);
            }
        );
    }

    public getOneById(correlationId: string, id: string,
        callback: (err: any, item: CreditCardV1) => void): void {
        this._client.creditCard.get(id, (err, data) => {
            if (err != null && err.httpStatusCode == 404)
                err = null;

            let item = this.toPublic(data);
            callback(err, item);
        });
    }

    public create(correlationId: string, item: CreditCardV1,
        callback: (err: any, item: CreditCardV1) => void): void {
        item = _.omit(item, 'id');
        item = this.fromPublic(item);

        this._client.creditCard.create(item, (err, data) => {
            item = this.toPublic(data);
            callback(err, item);
        });
    }

    public update(correlationId: string, item: CreditCardV1,
        callback: (err: any, item: CreditCardV1) => void): void {
        let id = item.id;
        let data: any = this.fromPublic(item);

        // Delete and then recreate, because some fields are read-only in PayPal
        this._client.creditCard.del(id, (err) => {
            if (err) {
                callback(err, null);
                return;
            }

            this._client.creditCard.create(data, (err, data) => {
                item = this.toPublic(data);
                callback(err, item);
            });
        });
    }

    public deleteById(correlationId: string, id: string,
        callback: (err: any, item: CreditCardV1) => void): void {
        this._client.creditCard.get(id, (err, data) => {
            if (err != null || data == null) {
                callback(err, null);
                return;
            }

            let item = this.toPublic(data);

            this._client.creditCard.del(id, (err) => {
                callback(err, item);
            });
        });
    }

    public clear(correlationId: string, callback: (err: any) => void): void {
        let page = 0;
        let pageSize = 20;
        let creditCards: any[] = []

        async.doWhilst(
            (callback) => {
                page++;

                let options = {
                    page_size: pageSize,
                    page: page
                };

                this._client.creditCard.list(options, (err, page) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    creditCards = page.items;

                    async.each(
                        creditCards,
                        (creditCard, callback) => {
                            this._client.creditCard.del(creditCard.id, (err) => {
                                callback(err);
                            });
                        },
                        callback
                    );
                });
            },
            () => creditCards.length == pageSize,
            callback
        );
    }
}
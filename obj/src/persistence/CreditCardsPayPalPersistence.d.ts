import { FilterParams } from 'pip-services-commons-node';
import { PagingParams } from 'pip-services-commons-node';
import { DataPage } from 'pip-services-commons-node';
import { ConfigParams } from 'pip-services-commons-node';
import { IConfigurable } from 'pip-services-commons-node';
import { IReferences } from 'pip-services-commons-node';
import { IReferenceable } from 'pip-services-commons-node';
import { IOpenable } from 'pip-services-commons-node';
import { ICleanable } from 'pip-services-commons-node';
import { CreditCardV1 } from '../data/version1/CreditCardV1';
import { ICreditCardsPersistence } from './ICreditCardsPersistence';
export declare class CreditCardsPayPalPersistence implements ICreditCardsPersistence, IConfigurable, IReferenceable, IOpenable, ICleanable {
    private _sandbox;
    private _credentialsResolver;
    private _logger;
    private _client;
    constructor();
    configure(config: ConfigParams): void;
    setReferences(references: IReferences): void;
    isOpened(): boolean;
    open(correlationId: string, callback: (err: any) => void): void;
    close(correlationId: string, callback: (err: any) => void): void;
    private toPublic(value);
    private fromPublic(value);
    getPageByFilter(correlationId: string, filter: FilterParams, paging: PagingParams, callback: (err: any, page: DataPage<CreditCardV1>) => void): void;
    getOneById(correlationId: string, id: string, callback: (err: any, item: CreditCardV1) => void): void;
    create(correlationId: string, item: CreditCardV1, callback: (err: any, item: CreditCardV1) => void): void;
    update(correlationId: string, item: CreditCardV1, callback: (err: any, item: CreditCardV1) => void): void;
    deleteById(correlationId: string, id: string, callback: (err: any, item: CreditCardV1) => void): void;
    clear(correlationId: string, callback: (err: any) => void): void;
}

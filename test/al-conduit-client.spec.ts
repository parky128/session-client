import { AlConduitClient } from '../src/utilities';
import { expect } from 'chai';
import { describe, before } from 'mocha';

describe('AlConduitClient', () => {
    let conduitClient = new AlConduitClient();

    describe("after initialization", () => {
        expect( conduitClient['conduitUri'] ).to.equal( undefined );
        expect( conduitClient['conduitWindow'] ).to.equal( undefined );
        expect( conduitClient['conduitOrigin'] ).to.equal( undefined );
        expect( conduitClient['requestIndex'] ).to.equal( 0 );
    } );
} );

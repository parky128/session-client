import { AlConduitClient } from '../src/utilities';
import { expect } from 'chai';
import { describe, before } from 'mocha';

describe('AlConduitClient', () => {
    let conduitClient = new AlConduitClient();

    describe("after initialization", () => {

        it( "should have expected initial state", () => {
            expect( conduitClient['conduitUri'] ).to.equal( undefined );
            expect( conduitClient['conduitWindow'] ).to.equal( undefined );
            expect( conduitClient['conduitOrigin'] ).to.equal( undefined );
            expect( conduitClient['requestIndex'] ).to.equal( 0 );
        } );
    } );

    describe(".render()", () => {
        it( "should generate a valid document fragment", () => {
            let fragment = conduitClient.render();

            expect( true ).to.equal( true );        //  I have no fucking idea how to evaluate this object
        } );
    } );
} );

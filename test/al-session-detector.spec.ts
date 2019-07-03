import { AlSessionDetector, AlConduitClient } from '../src/utilities';
import { expect } from 'chai';
import { describe, before } from 'mocha';

describe('AlSessionDetector', () => {
    let conduit = new AlConduitClient();
    let sessionDetector = new AlSessionDetector( conduit );

    describe("after initialization", () => {
        it( "should have known properties", () => {
            expect( sessionDetector.authenticated ).to.equal( false );
        } );
    } );

    describe("getAuth0Config", () => {
        it( "should produce configuration values in an expected way", () => {
            let config = sessionDetector.getAuth0Config();
            expect( config.domain ).to.equal("alertlogic.auth0.com");
            expect( config.responseType ).to.equal( "token id_token" );
            expect( config.audience ).to.equal( "https://alertlogic.com/" );
            expect( config.scope ).to.equal( "openid user_metadata" );
            expect( config.prompt ).to.equal( true );
            expect( config.redirectUri ).to.equal( window.location.origin );

            config = sessionDetector.getAuth0Config( { scope: "openid", prompt: "none" } );
            expect( config.scope ).to.equal( "openid" );
            expect( config.prompt ).to.equal( "none" );
        } );
    } );

} );

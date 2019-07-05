import { AlSessionDetector, AlConduitClient } from '../src/utilities';
import { AIMSAuthentication } from '@al/aims';
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

    describe(".getAuth0Config", () => {
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

    describe(".getTokenExpiration", () => {
        it( "should extract a timestamp from a properly formatted JWT", () => {
            let timestamp = sessionDetector['getTokenExpiration']("blahblahblah.eyJleHAiOjEwMDAwMDAwLCJzb21ldGhpbmcgZWxzZSI6ImhhaGEifQ==.blahblahblah" );
            expect( timestamp ).to.equal( 10000000 );
        } );
        it( "should return 0 for invalid JWTs", () => {
            let timestamp;

            //  Wrong wrapper format
            timestamp = sessionDetector['getTokenExpiration']("totally wrong");
            expect( timestamp ).to.equal( 0 );

            //  Token information segment is not base64 encoded
            timestamp = sessionDetector['getTokenExpiration']("blahblahblah.blahblahblah.blahblahblah" );
            expect( timestamp ).to.equal( 0 );

            //  Token information segment doesn't have an `exp` property
            timestamp = sessionDetector['getTokenExpiration']("blahblahblah.eyJleHBpcmF0aW9uIjoxMDAwMDAwMCwia2V2aW4iOiJ3YXMgaGVyZSJ9.blahblahblah" );
            expect( timestamp ).to.equal( 0 );
        } );
    } );

    describe(".normalizeAIMSSessionData", () => {
        it( "should calculate token expiration if it is not already included in the session data object", async () => {
            let authenticationData = {
                user: {
                    id: 1,
                    name: "Some User"
                },
                account: {
                    id: 1,
                    name: "Some Account"
                },
                token: "blahblahblah.eyJleHAiOjEwMDAwMDAwLCJzb21ldGhpbmcgZWxzZSI6ImhhaGEifQ==.blahblahblah"
            };
            let data = await sessionDetector['normalizeAIMSSessionData']( <any>authenticationData );
            expect( data.token_expiration ).to.equal( 10000000 );
        } );
    } );

    describe(".extractUserInfo", () => {
        it( "should get an accountId/userId pair from validly formatted auth0 identity data", () => {
            let identityData = {
                "https://alertlogic.com/": {
                    sub: "2:10001000-1000"
                }
            };
            let identityInfo = sessionDetector['extractUserInfo']( identityData );
            expect( identityInfo ).to.be.an( 'object' );
            expect( identityInfo.accountId ).to.equal( "2" );
            expect( identityInfo.userId ).to.equal( "10001000-1000" );
        } );

        it( "should throw in the face of invalid input data", () => {
            let identityData = {
                "https://mcdonalds-restaurants.com/": {
                    sub: "2:10001000-1000"
                }
            };
            expect( () => { sessionDetector['extractUserInfo']( identityData ); } ).to.throw();
        } );
    } );

} );

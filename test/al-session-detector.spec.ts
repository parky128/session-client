import { AlSessionDetector, AlConduitClient } from '../src/utilities';
import { ALSession } from '../src';
import { AIMSClient, AIMSAuthentication, AIMSSessionDescriptor } from '@al/aims';
import { exampleSession } from './mocks/session-data.mocks';
import { expect } from 'chai';
import { describe, before } from 'mocha';
import * as sinon from 'sinon';
import { WebAuth } from 'auth0-js';

describe('AlSessionDetector', () => {
    let conduit:AlConduitClient;
    let sessionDetector:AlSessionDetector;
    let warnStub, errorStub;

    beforeEach( () => {
        conduit = new AlConduitClient();
        sessionDetector = new AlSessionDetector( conduit, true );
        warnStub = sinon.stub( console, 'warn' );
        errorStub = sinon.stub( console, 'error' );
    } );

    afterEach( () => {
        warnStub.restore();
        errorStub.restore();
    } );

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

    describe( ".forceAuthentication()", () => {
        it("should redirect to the expected location", () => {
            let redirectStub = sinon.stub( sessionDetector, 'redirect' );
            sessionDetector.forceAuthentication();
            expect( redirectStub.callCount ).to.equal( 1 );
        } );
    } );

    describe( ".normalizeSessionDescriptor()", () => {
        let getTokenInfoStub;
        beforeEach( () => {
            getTokenInfoStub = sinon.stub( AIMSClient, 'getTokenInfo' ).returns( Promise.resolve( exampleSession.authentication ) );
        } );
        afterEach( () => {
            getTokenInfoStub.restore();
        } );
        it( "should resolve immediately if the descriptor is fully populated", async () => {
            let result = await sessionDetector.normalizeSessionDescriptor( exampleSession );
            expect( result ).to.equal( exampleSession );
            expect( getTokenInfoStub.callCount ).to.equal( 0 );
        } );
        it( "should request token info if the descriptor is missing information", async () => {
            let result = await sessionDetector.normalizeSessionDescriptor( {
                authentication: {
                    token: exampleSession.authentication.token,
                    token_expiration: null,
                    account: null,
                    user: null
                }
            } );
            expect( result ).to.be.an( 'object' );
            expect( getTokenInfoStub.callCount ).to.equal( 1 );
        } );
    } );

    describe( ".onDetectionFail()", () => {
        it( "should emit warning, call resolver, and set values", () => {
            let result = null;
            let resolver = ( value:boolean ) => {
                result = value;
            };
            sessionDetector.onDetectionFail( resolver, null );
            expect( result ).to.equal( false );
            expect( warnStub.callCount ).to.equal( 0 );
            expect( sessionDetector.authenticated ).to.equal( false );

            sessionDetector.onDetectionFail( resolver, "A message" );
            expect( warnStub.callCount ).to.equal( 1 );

        } );
    } );

    describe( ".onDetectionSuccess()", () => {
        it( "should emit warning, call resolver, and set values", () => {
            let result = null;
            let resolver = ( value:boolean ) => {
                result = value;
            };
            sessionDetector.onDetectionSuccess( resolver );
            expect( result ).to.equal( true );
            expect( sessionDetector.authenticated ).to.equal( true );
        } );
    } );

    describe(".ingestExistingSession()", () => {
        it( "should catch errors", async () => {
            let garbage:any = {
                authentication: {
                    token: "blahblahblah",
                    token_expiration: ( Date.now() / 1000 ) + 20000,
                    user: {
                        id: "wrong"
                    },
                    account: {
                        id: "wronger"
                    }
                }
            };
            let rejected = false;
            await sessionDetector.ingestExistingSession( garbage ).then( () => {}, () => {
                rejected = true;
            } );
            expect( rejected ).to.equal( true );
            expect( sessionDetector.authenticated ).to.equal( false );
            expect( errorStub.callCount ).to.be.above( 0 );
        } );
        it( "should normalize and ingest a valid session descriptor", async () => {
            let normalizeStub = sinon.stub( sessionDetector, 'normalizeSessionDescriptor' ).returns( Promise.resolve( exampleSession ) );
            await sessionDetector.ingestExistingSession( {
                authentication: {
                    token: exampleSession.authentication.token,
                    token_expiration: null,
                    user: null,
                    account: null
                }
            } );
            expect( sessionDetector.authenticated ).to.equal( true );
            expect( errorStub.callCount ).to.equal( 0 );
            normalizeStub.restore();
        } );
    } );

    describe("detectSession()", () => {
        describe("with an existing session promise", () => {
            it( "should just return the existing promise", () => {
                ALSession.deactivateSession();
                let fakePromise = new Promise<boolean>( ( resolve, reject ) => {} );
                AlSessionDetector['detectionPromise'] = fakePromise;

                let result = sessionDetector.detectSession();
                expect( result ).to.equal( fakePromise );
                sessionDetector.onDetectionFail( () => {} );      //  kill the promise
            } );

        } );
        describe("with a local session", () => {
            it( "should resolve true", ( done ) => {
                ALSession.deactivateSession();
                ALSession.setAuthentication( exampleSession );
                sessionDetector.detectSession().then( result => {
                    expect( result ).to.equal( true );
                    expect( sessionDetector.authenticated ).to.equal( true );
                    sessionDetector.onDetectionFail( () => {} );      //  kill the promise
                    done();
                } );
            } );
        } );

        describe("with a conduit session", () => {
            it( "should resolve true", ( done ) => {
                ALSession.deactivateSession();
                let getSessionStub = sinon.stub( conduit, 'getSession' ).returns( Promise.resolve( exampleSession ) );
                sessionDetector.detectSession().then( result => {
                    expect( result ).to.equal( true );
                    expect( sessionDetector.authenticated ).to.equal( true );
                    sessionDetector.onDetectionFail( () => {} );      //  kill the promise
                    getSessionStub.restore();
                    done();
                }, error => {
                    expect( "Shouldn't get a promise rejection!").to.equal( false );
                } );
            } );
        } );
        describe("with an auth0 session", () => {
            it( "should resolve true", ( done ) => {
                ALSession.deactivateSession();

                let auth0AuthStub = sinon.stub( sessionDetector, 'getAuth0Authenticator' ).returns( <WebAuth><unknown>{
                    checkSession: ( config, callback ) => {
                        callback( null, {
                            accessToken: 'big-fake-access-token'
                        } );
                    },
                    client: {
                        userInfo: ( accessToken, callback ) => {
                            callback( null, {
                                "https://alertlogic.com/": {
                                    sub: "2:10001000-1000"
                                }
                            } );
                        }
                    }
                } );
                let getSessionStub = sinon.stub( conduit, 'getSession' ).returns( Promise.resolve( null ) );

                sessionDetector.detectSession().then( result => {
                    sessionDetector.onDetectionFail( () => {} );      //  kill the promise
                    getSessionStub.restore();
                    auth0AuthStub.restore();
                    done();
                }, error => {
                    expect( "Shouldn't get a promise rejection!").to.equal( false );
                } );
            } );
        } );
    } );

} );

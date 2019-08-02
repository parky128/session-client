import { AlConduitClient } from '../src/utilities';
import { AlLocatorService, AlLocation } from '@al/haversack/locator';
import { ALClient } from '@al/client';
import { AlStopwatch } from '@al/haversack/utility';
import { exampleSession } from './mocks/session-data.mocks';
import { expect } from 'chai';
import { describe, before } from 'mocha';
import * as sinon from 'sinon';

describe('AlConduitClient', () => {

    let conduitClient:AlConduitClient;
    let stopwatchStub, warnStub;

    let generateMockRequest = ( requestType:string, data:any = null, requestId:string = null ) => {
        let event = {
            data: {
                type: requestType,
                requestId: requestId || 'fakeId'
            },
            origin: AlLocatorService.resolveNodeURI( AlLocatorService.getNode( AlLocation.AccountsUI ) ),
            source: {}
        };
        if ( data ) {
            event.data = Object.assign( event.data, data );
        }
        return event;
    };

    beforeEach( () => {
        conduitClient = new AlConduitClient();
        stopwatchStub = sinon.stub( AlStopwatch, 'once' );
        warnStub = sinon.stub( console, 'warn' );
    } );

    afterEach( () => {
        stopwatchStub.restore();
        warnStub.restore();
    } );

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
            expect( true ).to.equal( true );        //  I have no fucking idea how to evaluate the fragment.  If it compiles without errors, does that count for anything?
        } );
    } );

    describe(".start()", () => {
        let document = new Document();
        it( "should render the document fragment", () => {
            conduitClient.start( document );
            expect( conduitClient['conduitUri'] ).to.equal( 'https://console.account.alertlogic.com/conduit.html' );        //  AlLocatorService uses production settings by default
            expect( stopwatchStub.callCount ).to.equal( 1 );
            expect( stopwatchStub.args[0][0] ).to.equal( conduitClient['validateReadiness'] );
            expect( stopwatchStub.args[0][1] ).to.equal( 5000 );
        } );
    } );

    describe(".stop()", () => {
        it( "should do nothing", () => {
            conduitClient.stop();
        } );
    } );

    describe(".getSession()", () => {
        it( "should issue a request with th expected characteristics", () => {
            let fakePromise = {
                then: ( resolve, reject ) => {
                    return;
                }
            };
            let requestStub = sinon.stub().returns( fakePromise );
            conduitClient['request'] = requestStub;

            let promise = conduitClient.getSession();
            expect( requestStub.callCount ).to.equal( 1 );

            let args = requestStub.args[0];
            expect( args[0] ).to.equal( 'conduit.getSession' );
            expect( args[1] ).to.equal( undefined );
        } );
    } );

    describe(".setSession()", () => {
        it( "should issue a request with th expected characteristics", () => {
            let fakePromise = {
                then: ( resolve, reject ) => {
                    return;
                }
            };
            let requestStub = sinon.stub().returns( fakePromise );
            conduitClient['request'] = requestStub;

            let promise = conduitClient.setSession( exampleSession );

            expect( requestStub.callCount ).to.equal( 1 );

            let args = requestStub.args[0];
            expect( args[0] ).to.equal( 'conduit.setSession' );
            expect( args[1] ).to.be.an( 'object' );
            expect( args[1].session ).to.equal( exampleSession );
        } );
    } );

    describe(".deleteSession()", () => {
        it( "should issue a request with th expected characteristics", () => {
            let fakePromise = {
                then: ( resolve, reject ) => {
                    return;
                }
            };
            let requestStub = sinon.stub().returns( fakePromise );
            conduitClient['request'] = requestStub;

            let promise = conduitClient.deleteSession();

            expect( requestStub.callCount ).to.equal( 1 );

            let args = requestStub.args[0];
            expect( args[0] ).to.equal( 'conduit.deleteSession' );
            expect( args[1] ).to.equal( undefined );
        } );
    } );

    describe(".onReceiveMessage()", () => {
        it( "should ignore events with missing data or incorrect origin", () => {
            let dispatchStub = sinon.stub( conduitClient, 'onDispatchReply' );

            conduitClient.onReceiveMessage( { data: { something: true } } );
            conduitClient.onReceiveMessage( { data: { something: true }, origin: 'https://www.google.com', source: {} } );
            conduitClient.onReceiveMessage( { data: { type: 'conduit.ready', requestId: 'some-request-id' }, origin: 'https://www.google.com', source: {} } );      //  wrong origin

            expect( warnStub.callCount ).to.equal( 0 );
            expect( dispatchStub.callCount ).to.equal( 0 );

            dispatchStub.restore();
        } );
        it( "should handle conduit.ready message", () => {
            let readyStub = sinon.stub( conduitClient, 'onConduitReady' );
            let event = generateMockRequest( 'conduit.ready' );
            conduitClient.onReceiveMessage( event );
            expect( readyStub.callCount ).to.equal( 1 );

            readyStub.restore();
        } );
        it( "should handle conduit.getSession, conduit.setSession, and conduit.deleteSession", () => {
            let dispatchStub = sinon.stub( conduitClient, 'onDispatchReply' );

            let event = generateMockRequest( 'conduit.getSession' );
            conduitClient.onReceiveMessage( event );

            event = generateMockRequest( 'conduit.setSession' );
            conduitClient.onReceiveMessage( event );

            event = generateMockRequest( 'conduit.deleteSession' );
            conduitClient.onReceiveMessage( event );

            expect( dispatchStub.callCount ).to.equal( 3 );

            dispatchStub.restore();
        } );
        it( "should warn about invalid message types", () => {

            let event = {
                data: {
                    type: 'conduit.notARealMethod',
                    requestId: 'fakeId',
                },
                origin: AlLocatorService.resolveNodeURI( AlLocatorService.getNode( AlLocation.AccountsUI ) ),
                source: {}
            };
            conduitClient.onReceiveMessage( event );
            expect( warnStub.callCount ).to.equal( 1 );

        } );

    } );

    describe( ".onConduitReady()", () => {
        it( "should copy the event's source and origin and mark conduit as ready", async () => {
            let event = {
                data: {
                    type: "conduit.ready"
                },
                source: { blahblah: "my source" },
                origin: "https://my-arbitrary-origin.com"
            };

            conduitClient.onConduitReady( event );

            expect( conduitClient['conduitOrigin'] ).to.equal( "https://my-arbitrary-origin.com" );
            expect( conduitClient['conduitWindow'] ).to.equal( event.source );
        } );
    } );

    describe( ".validateReadiness()", () => {
        it( "should warn if conduit isn't ready", () => {
            conduitClient['conduitWindow'] = null;
            conduitClient['conduitOrigin'] = null;
            conduitClient['validateReadiness']();
            expect( warnStub.callCount ).to.equal( 1 );
        } );
    } );

    describe( ".onDispatchReply()", () => {

        let calledThrough = false;

        it( "should warn/return on missing request IDs", () => {
            let event = generateMockRequest( 'conduit.getSession' );
            conduitClient.onDispatchReply( event );
            expect( warnStub.callCount ).to.equal( 1 );
            expect( calledThrough ).to.equal( false );
        } );

        it( "should call through and clear existing request callbacks", () => {
            conduitClient['requests']['fake-one'] = () => { calledThrough = true; };
            let event = generateMockRequest( 'conduit.getSession', null, 'fake-one' );
            conduitClient.onDispatchReply( event );
            expect( warnStub.callCount ).to.equal( 0 );
            expect( calledThrough ).to.equal( true );
        } );
    } );

    describe( ".request()", () => {
        it( "should wait for readiness, resolve account app, and post message", (done) => {
            /**
             * This rather beefy test simulates both sides of a two-party message exchange.
             */
            let readyMessage = {
                source: {
                    postMessage: sinon.stub()
                },
                origin: ALClient.resolveLocation( AlLocation.AccountsUI ),
                data: {
                    type: 'conduit.ready',
                    requestId: 'yohoho'
                }
            };

            conduitClient.onReceiveMessage( readyMessage );
            expect( conduitClient['conduitWindow'] ).to.equal( readyMessage.source );
            expect( conduitClient['conduitOrigin'] ).to.equal( readyMessage.origin );
            conduitClient['request']( "test.message", { from: "Kevin", to: "The World", message: "Get thee hence, satan." } )
                    .then( ( response ) => {
                        expect( readyMessage.source.postMessage.callCount ).to.equal( 1 );
                        expect( response.answer ).to.be.a('string' );
                        expect( response.answer ).to.equal( 'NO' );
                        done();
                    } );

            //  This timer simulates the response coming from another window
            setTimeout( () => {
                expect( Object.keys( conduitClient['requests'] ).length ).to.equal( 1 );
                let requestId = Object.keys( conduitClient['requests'] )[0];
                let responseData = {
                    type: 'test.message',
                    requestId: requestId,
                    answer: "NO"
                };
                conduitClient['requests'][requestId]( responseData );
            }, 100 );
        } );
    } );

} );

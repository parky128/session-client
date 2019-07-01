/**
 *  @author Kevin Nielsen <knielsen@alertlogic.com>
 *  @author Robert Parker <robert.parker@alertlogic.com>
 *
 *  @copyright Alert Logic, Inc 2019
 */

import { WebAuth } from 'auth0-js';
import { AlLocatorService, AlLocation } from '@al/haversack/locator';
import { AlBehaviorPromise } from '@al/haversack/promises';
import { AlSession } from '../al-session';
import { ALClient } from '@al/client';
import { AIMSClient, AIMSSessionDescriptor, AIMSAuthentication } from '@al/aims';
import { AlConduitClient } from './al-conduit-client';

export class AlSessionDetector
{
    /*----- Private Static Properties ------------------------
    /**
     *  A cached copy of the auth0 client interface
     */
    protected static auth0Client:WebAuth = null;

    /**
     * If session detection is currently executing, this is the observable in progress.
     */
    protected static detectionPromise:Promise<boolean> = null;

    /**
     * Cached userInfo (this holds data from auth0's userInfo endpoint, keyed by access token)
     */
    protected static cachedA0UserInfo:{[accessKey:string]:any} = {};

    /*----- Public Instance Properties -----------------------
    /**
     *  Indicates whether or not this authentication provider is currently authenticated.
     */
    public authenticated:boolean = false;

    /**
     *
     */
    constructor( public conduit:AlConduitClient,
                 public useAuth0:boolean = false ) {
    }

    /**
     * Calculates the correct auth0 configuration to use.
     */
    public getAuth0Config( merge:any = {} ):any {
        let w = <any>window;
        let auth0Node = AlLocatorService.getNode( AlLocation.Auth0 );
        if ( ! auth0Node || ! auth0Node.data || ! auth0Node.data.hasOwnProperty( 'clientID' ) ) {
            throw new Error("Service matrix does not reflect an auth0 node; check your app configuration." );
        }
        return Object.assign(   {
                                    domain:         auth0Node.uri,
                                    clientID:       auth0Node.data.clientID,
                                    responseType:   'token id_token',
                                    audience:       'https://alertlogic.com/',
                                    scope:          'openid user_metadata',
                                    prompt:         true,
                                    redirectUri:    w.location.origin
                                },
                                merge );
    }

    /**
     * Retrieve a reference to the Auth0 web auth instance.
     */
    public getAuth0Authenticator():WebAuth {
        if ( ! AlSessionDetector.auth0Client ) {
            /* Because Auth0 persists itself as a global, we will need to cast it from <any>window.auth.  Fun stuff :/ */
            let w = <any>window;
            if ( ! w.auth0 ) {
                throw new Error("Could not find the auth0 global object; is Auth0 installed?" );
            }
            let authenticator = <WebAuth>new w.auth0.WebAuth( this.getAuth0Config() );
            if ( ! authenticator.hasOwnProperty("client" ) ) {
                throw new Error("auth0.WebAuth instance does not have a client property; wrong version perhaps?" );
            }
            AlSessionDetector.auth0Client = authenticator;
        }
        return AlSessionDetector.auth0Client;
    }

    /**
     *  Checks to see if a session already exists.
     *  If a session exists or is discovered, the observable emits `true` and internal state is guaranteed to be authenticated and properly populated.
     *  If no session is found, the observable emits `false` and internal state is guaranteed to be clean and unauthenticated.
     *
     *  @param {string} preferredActingAccountId - If provided and there is no current session, this accountId will be used instead of the default/primary.
     */
    public detectSession( preferredActingAccountId:string = null ): Promise<boolean> {

        if ( AlSessionDetector.detectionPromise ) {
            return AlSessionDetector.detectionPromise;
        }

        AlSessionDetector.detectionPromise = new Promise( ( resolve, reject ) => {

            /**
             * Handler for detection failure cases
             */
            let detectionFail = ( warning:string = null ):void => {
                if ( warning ) {
                    console.warn( warning );
                }
                this.authenticated = false;
                AlSessionDetector.detectionPromise = null;
                resolve( false );
            };

            /**
             * Handler for detection success
             */
            let detectionSuccess = () => {
                this.authenticated = true;
                AlSessionDetector.detectionPromise = null;
                resolve( true );
            };

            /**
             * Does AlSession say we're active?  If so, then yey!
             */
            if ( AlSession.isActive() ) {
                return detectionSuccess();
            }

            /**
             * Check conduit to see if it has a session available
             */
            this.conduit.getSession()
                .then( session => {
                    if ( session && typeof( session ) === 'object' ) {
                        this.ingestAIMSAuthentication( session.authentication )
                            .then(  () => {
                                        detectionSuccess();
                                    },
                                    error => {
                                        this.conduit.deleteSession().then( () => {
                                            detectionFail("Conduit session could not be ingested; destroying it and triggering unauthenticated access handling.");
                                        } );
                                    } );
                    } else if ( this.useAuth0 ) {
                        try {
                            let authenticator = this.getAuth0Authenticator();
                            let config = this.getAuth0Config( { usePostMessage: true, prompt: 'none' } );
                            console.log("Checking for auth0 session...", config );
                            authenticator.checkSession( config, ( error, authResult ) => {
                                console.log("Auth0 session check result: ", error, authResult );
                                if ( error || ! authResult.accessToken ) {
                                    return detectionFail("Notice: AIMSAuthProvider.detectSession cannot detect any valid, existing session." );
                                }
                                /**
                                 *  If there is a token, it is quite likely that we were redirected to this page by silent authentication.
                                 *  We need to validate the authentication data and, if successful, persist it in session storage
                                 *  via brainstem.  We will assume an authenticated status *until proven otherwise* to prevent
                                 *  authorization requirements from prompting a redirect.
                                 */

                                this.getAuth0UserInfo( authenticator, authResult.accessToken, ( userInfoError, userIdentityInfo ) => {
                                    if ( userInfoError || ! userIdentityInfo ) {
                                        return detectionFail("Auth0 session detection failure: failed to retrieve user information with valid session!");
                                    }

                                    let identityInfo = this.extractUserInfo( userIdentityInfo );
                                    if ( identityInfo.accountId === null || identityInfo.userId === null ) {
                                        return detectionFail("Auth0 session detection failure: session lacks identity information!");
                                    }

                                    detectionFail("Auth0 not hooked up yet" );
                                    /*
                                    this.retrieveUser( identityInfo.accountId, identityInfo.userId ).subscribe( userRecord => {
                                            //  In this final success case, what we are effectively doing is
                                            //  simulating the response we'd get directly from AIMS' authenticate endpoint.
                                            let authData:AIMSSessionDescriptor = {
                                                authentication: {
                                                    token: authResult.accessToken,
                                                    token_expiration: 0,
                                                    user: userRecord,
                                                    account: null
                                                }
                                            };
                                            console.log("Got auth0 user info..." );
                                        }, retrieveUserError => {
                                            return detectionFail( `Unexpected error: could not retrieve AIMS user record for existing session for user ${identityInfo.accountId} / ${identityInfo.userId}.`);
                                        } );
                                     */
                                } );
                            } );
                        } catch( e ) {
                            console.log("Could not check session" );
                            return detectionFail(`Unexpected error: encountered exception while checking session: ${e.toString()}`);
                        }
                    }
                } );
        } );

        return AlSessionDetector.detectionPromise;
    }

    /**
     *  AIMS Native Token processing.  This is a stub for future functionality.
     */
    public ingestAIMSAuthentication(session: AIMSAuthentication): Promise<boolean> {
        return new Promise<boolean>( (resolve,reject) => {
            const fail = (message: string) => {
                this.authenticated = false;
                console.log("Failed to ingest AIMS authentication....", message );
                reject( new Error( message ) );
            };

            this.authenticated = true;
            this.normalizeAIMSSessionData(session)
                .then(  normalizedSession => {
                            try {
                                console.log("Starting authentication with session data ", normalizedSession );
                                AlSession.setAuthentication({
                                  authentication: normalizedSession
                                });
                                resolve( true );
                            } catch( e ) {
                                fail( e.message );
                            }
                        },
                        error => {
                            console.log("Error: ", error );
                            fail(`AlSessionDetector: failed to normalize the available session data!`);
                        } );
        } );
    }

    public forceAuthentication() {
        const loginUri = ALClient.resolveLocation(AlLocation.AccountsUI, '/#/login');
        const returnUri = window.location.origin + ((window.location.pathname && window.location.pathname.length > 1) ? window.location.pathname : "") + "/#/authenticate";
        const redirectUri = `${loginUri}?return=${encodeURIComponent(returnUri)}&token=aims_token`;
        console.warn('Not authenticated: redirecting to %s', redirectUri);
        window.location.replace(redirectUri);
    }


    protected getAuth0UserInfo = ( authenticator:WebAuth, userAccessToken:string, callback:(error:any, userInfo:any)=>void ) => {
        if ( AlSessionDetector.cachedA0UserInfo.hasOwnProperty( userAccessToken ) ) {
            callback( null, AlSessionDetector.cachedA0UserInfo[userAccessToken] );
            return;
        }

        authenticator.client.userInfo( userAccessToken, ( userInfoError, userIdentityInfo ) => {
            if ( ! userInfoError && userIdentityInfo ) {
                AlSessionDetector.cachedA0UserInfo[userAccessToken] = userIdentityInfo;        //  cache
            }
            callback( userInfoError, userIdentityInfo );
        } );
    }

    /**
     *  Extracts necessary data from the response to auth0's getUserInfo endpoint
     */
    protected extractUserInfo = ( identityData:any ) => {
        let config = this.getAuth0Config();
        let auth0Node = AlLocatorService.getNode( AlLocation.Auth0 );
        if ( ! auth0Node || ! auth0Node.data || ! auth0Node.data.hasOwnProperty( "clientID" ) ) {
            throw new Error("Configuration's service list does not include an entry for auth0 with a 'clientID' property!; check your configuration." );
        }
        let domainIdInfo    =   "";

        if ( identityData.hasOwnProperty( config.audience ) ) {
            domainIdInfo = identityData[config.audience].sub;
        } else {
            throw new Error(`Unexpected identity data received from auth0; no audience '${config.audience}' found.` );
        }

        let userInfo        =   domainIdInfo.split(":");
        let accountId       =   userInfo.length > 1 ? userInfo[0] : null;
        let userId          =   userInfo.length > 1 ? userInfo[1] : null;
        return {
            "accountId": accountId,
            "userId": userId
        };
    }

    /**
     * Given an AIMSAuthentication proposal, this method will extend any missing pieces of information and complete with the fully
     * populated object.
     */
    protected normalizeAIMSSessionData(session: AIMSAuthentication): Promise<AIMSAuthentication> {
        return new Promise<AIMSAuthentication>( ( resolve, reject ) => {
            if ( ! session.hasOwnProperty('token_expiration') ) {
                session.token_expiration = this.getTokenExpiration( session.token );
            }
            resolve( session );
        } );
    }

    /**
     * Given a token, determine its expiration timestamp in seconds.
     */
    protected getTokenExpiration( token:string ) {
        const split = token.split('.');
        if (!split || split.length < 2 ) {
            console.warn("Warning: unexpected JWT format causing existing session not to be recognized." );
            return 0;
        }
        const base64Url = split[1];
        const base64 = base64Url.replace('-', '+').replace('_', '/');
        let userData;
        try {
            userData = JSON.parse(window.atob(base64));
        } catch (e) {
            console.warn("Warning: invalid JWT encoding causing existing session not to be recognized." );
            return 0;
        }

        if (!('exp' in userData)) {
            console.warn("Warning: invalid JWT user data causing existing session not to be recognized." );
            return 0;
        }

        return userData.exp;
    }

}

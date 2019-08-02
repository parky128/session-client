/**
 *  @author Kevin Nielsen <knielsen@alertlogic.com>
 *  @author Robert Parker <robert.parker@alertlogic.com>
 *
 *  @copyright Alert Logic, Inc 2019
 */

import { WebAuth } from 'auth0-js';
import { AlLocatorService, AlLocation } from '@al/haversack/locator';
import { AlBehaviorPromise } from '@al/haversack/promises';
import { ALSession } from '../index';
import { ALClient } from '@al/client';
import { AIMSClient, AIMSSessionDescriptor, AIMSAuthentication, AIMSUser, AIMSAccount } from '@al/aims';
import { AlConduitClient } from './al-conduit-client';

export class AlSessionDetector
{
    /*----- Private Static Properties ------------------------
    /**
     *  A cached copy of the auth0 client interface
     */
    protected static auth0Client:WebAuth = undefined;

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
                 public useAuth0:boolean = true ) {
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
            //  If we're already in the middle of detection, return the promise for the current detectino cycle rather than allowing multiple overlapping
            //  checks to run simultaneously.  No muss, no fuss!
            return AlSessionDetector.detectionPromise;
        }

        AlSessionDetector.detectionPromise = new Promise( ( resolve, reject ) => {

            /**
             * Does AlSession say we're active?  If so, then yey!
             */
            if ( ALSession.isActive() ) {
                return this.onDetectionSuccess( resolve );
            }

            /**
             * Check conduit to see if it has a session available
             */
            this.conduit.getSession()
                .then( session => {
                    if ( session && typeof( session ) === 'object' ) {
                        this.ingestExistingSession( session )
                            .then(  () => {
                                        this.onDetectionSuccess( resolve );
                                    },
                                    error => {
                                        this.conduit.deleteSession().then( () => {
                                            this.onDetectionFail( resolve, "Conduit session could not be ingested; destroying it and triggering unauthenticated access handling.");
                                        } );
                                    } );
                    } else if ( this.useAuth0 ) {
                        try {
                            let authenticator = this.getAuth0Authenticator();
                            let config = this.getAuth0Config( { usePostMessage: true, prompt: 'none' } );
                            authenticator.checkSession( config, ( error, authResult ) => {
                                if ( error || ! authResult.accessToken ) {
                                    return this.onDetectionFail( resolve, "Notice: AIMSAuthProvider.detectSession cannot detect any valid, existing session." );
                                }

                                this.getAuth0UserInfo( authenticator, authResult.accessToken, ( userInfoError, userIdentityInfo ) => {
                                    if ( userInfoError || ! userIdentityInfo ) {
                                        return this.onDetectionFail( resolve, "Auth0 session detection failure: failed to retrieve user information with valid session!");
                                    }

                                    let identityInfo = this.extractUserInfo( userIdentityInfo );
                                    if ( identityInfo.accountId === null || identityInfo.userId === null ) {
                                        return this.onDetectionFail( resolve, "Auth0 session detection failure: session lacks identity information!");
                                    }

                                    /* Missing properties (user, account, token_expiration) will be separately requested/calculated by normalizationSessionDescriptor */
                                    let session:AIMSSessionDescriptor = {
                                        authentication: {
                                            token: authResult.accessToken,
                                            token_expiration: null,
                                            user: null,
                                            account: null
                                        }
                                    };
                                    this.ingestExistingSession( session )
                                        .then(  () => {
                                                    this.onDetectionSuccess( resolve );
                                                },
                                                error => {
                                                    this.onDetectionFail( resolve, "Failed to ingest auth0 session" );
                                                } );
                                } );
                            } );
                        } catch( e ) {
                            return this.onDetectionFail( resolve, `Unexpected error: encountered exception while checking session: ${e.toString()}`);
                        }
                    }
                } );
        } );

        return AlSessionDetector.detectionPromise;
    }

    /**
     *  Imperatively forces the user to authenticate.
     */

    public forceAuthentication() {
        const loginUri = ALClient.resolveLocation(AlLocation.AccountsUI, '/#/login');
        const returnUri = window.location.origin + ((window.location.pathname && window.location.pathname.length > 1) ? window.location.pathname : "");
        this.redirect( `${loginUri}?return=${encodeURIComponent(returnUri)}&token=null`, "User is not authenticated; redirecting to login." );
    }

    /**
     *  Given an AIMSAuthentication object -- which defines the token, user, and account whose session is being
     *  referenced -- this method will collect any missing data elements
     */

    ingestExistingSession = async ( proposedSession: AIMSSessionDescriptor ):Promise<boolean> => {
        let session = await this.normalizeSessionDescriptor( proposedSession );
        try {
            ALSession.setAuthentication( session );
            this.authenticated = ALSession.isActive();
            return true;
        } catch( e ) {
            this.authenticated = false;
            console.error("Failed to ingest session: ", e );
            throw new Error( e.toString() );
        }
    }

    /* istanbul ignore next */
    redirect = ( targetUri:string, message:string = null ) => {
        if ( message ) {
            console.warn( message, targetUri );
        }
        window.location.replace(targetUri);
    }

    /**
     * Handles promise-based session-detection success (resolve true)
     */

    onDetectionFail = ( resolve:{(error:any):any}, warning:string = null ) => {
        if ( warning ) {
            console.warn( warning );
        }
        this.authenticated = false;
        AlSessionDetector.detectionPromise = null;
        resolve( false );
    }


    /**
     * Handles promise-based session-detection failure (resolve false)
     */

    onDetectionSuccess = ( resolve:{(result:any):any} ) => {
        this.authenticated = true;
        AlSessionDetector.detectionPromise = null;
        resolve( true );
    }

    /**
     * Normalizes session data.
     */
    normalizeSessionDescriptor( session:AIMSSessionDescriptor ):Promise<AIMSSessionDescriptor> {
        return new Promise<AIMSSessionDescriptor>( ( resolve, reject ) => {
            if ( ! session.authentication.hasOwnProperty('token_expiration') || session.authentication.token_expiration === null ) {
                session.authentication.token_expiration = this.getTokenExpiration( session.authentication.token );
            }
            if ( session.authentication.user && session.authentication.account ) {
                return resolve( session );
            }
            let tokenInfo = AIMSClient.getTokenInfo( session.authentication.token )
                .then(  tokenInfo => {
                            if ( typeof( tokenInfo.user ) === 'object' ) {
                                session.authentication.user = tokenInfo.user;
                            }
                            if ( typeof( tokenInfo.account ) === 'object' ) {
                                session.authentication.account = tokenInfo.account;
                            }
                            if ( tokenInfo.token_expiration ) {
                                session.authentication.token_expiration = tokenInfo.token_expiration;
                            }
                            return resolve( session );
                        },
                        error => {
                            reject( error );
                        } );
        } );
    }

    /**
     * Calculates the correct auth0 configuration to use.
     */
    getAuth0Config( merge:any = {} ):any {
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
     * Retrieve a reference to the Auth0 web auth instance.  This code is excluded from unit testing.
     */
    /* istanbul ignore next */
    getAuth0Authenticator():WebAuth {
        if ( AlSessionDetector.auth0Client === undefined ) {
            /* Because Auth0 persists itself as a global, we will need to cast it from <any>window.auth.  Fun stuff :/ */
            let w = <any>window;
            if ( ! w.auth0 ) {
                console.warn( "Could not find the auth0 global object; is Auth0 installed?" );
                AlSessionDetector.auth0Client = null;
                return null;
            }
            let authenticator = <WebAuth>new w.auth0.WebAuth( this.getAuth0Config() );
            if ( ! authenticator.hasOwnProperty("client" ) ) {
                //  Stop for this error, bad build?
                throw new Error("auth0.WebAuth instance does not have a client property; wrong version perhaps?" );
            }
            AlSessionDetector.auth0Client = authenticator;
        }
        return AlSessionDetector.auth0Client;
    }

    getAuth0UserInfo = ( authenticator:WebAuth, userAccessToken:string, callback:(error:any, userInfo:any)=>void ) => {
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
    extractUserInfo = ( identityData:any ) => {
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
     * Given a token, determine its expiration timestamp in seconds.
     */
    getTokenExpiration( token:string ) {
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

/**
 * An interface for establishing and persistenting an authenticated AIMS session.
 *
 * @author Barry Skidmore <bskidmore@alertlogic.com>
 * @author Robert Parker <robert.parker@alertlogic.com>
 * @author Kevin Nielsen <knielsen@alertlogic.com>
 *
 * @copyright 2019 Alert Logic, Inc.
 */

import {
    AlBehaviorPromise,
    AlGlobalizer, AlStopwatch,
    AlTriggerStream, AlTriggeredEvent,
    AlResponseValidationError,
    AlLocation, AlLocatorService, AlInsightLocations,
    AlCabinet
} from '@al/common';
import {
    AlSessionStartedEvent,
    AlSessionEndedEvent,
    AlActingAccountChangedEvent,
    AlActingAccountResolvedEvent,
    AlActiveDatacenterChangedEvent
} from './events';
import {
  AlChangeStamp, AIMSAuthentication, AIMSUser, AIMSAccount, AIMSSessionDescriptor,      /* core AIMS types */
  AlApiClient, AlDefaultClient,
  AIMSJsonSchematics,
  AlClientBeforeRequestEvent,
  ALClient
} from '@al/client';
import { AIMSClient } from '@al/aims';
import { AlEntitlementCollection, AlEntitlementRecord, SubscriptionsClient } from '@al/subscriptions';
import { AlNullSessionDescriptor } from './null-session';
import { AlConsolidatedAccountMetadata } from './types';

export interface AlSessionOptions {
    resolveAccountMetadata?:boolean;
}

/**
 * AlSessionInstance maintains session data for a specific session.
 */
export class AlSessionInstance
{
  /**
   * A stream of events that occur over the lifespan of a user session
   */
  public    notifyStream:AlTriggerStream        =   new AlTriggerStream();

  /**
   * Protected state properties
   */
  protected sessionIsActive                     =   false;
  protected client:AlApiClient                  =   null;
  protected sessionData: AIMSSessionDescriptor  =   JSON.parse(JSON.stringify(AlNullSessionDescriptor));

  /**
   * Tracks when the acting account is changing (measured as interval between AlActingAccountChangedEvent and AlActingAccountResolvedEvent)
   * and allows systematic access to the last set of resolved data.
   */
  protected resolvedAccount                     =   new AlActingAccountResolvedEvent( null, [], new AlEntitlementCollection() );    //  Acting account's account record, child account list, and entitlements
  protected primaryEntitlements                 =   new AlEntitlementCollection();                                                  //  Primary account's entitlements
  protected resolutionGuard                     =   new AlBehaviorPromise<boolean>();                                               //  This functions as a mutex so that access to resolvedAccount is only available at appropriate times
  protected storage                             =   AlCabinet.persistent( "al_session" );
  protected options:AlSessionOptions = {
    resolveAccountMetadata: true
  };

  constructor( client:AlApiClient = null ) {
    this.client = client || AlDefaultClient;
    this.notifyStream.siphon( this.client.events );
    this.notifyStream.attach( AlClientBeforeRequestEvent, ( event:AlClientBeforeRequestEvent ) => {
        if ( this.sessionIsActive ) {
            event.request.headers = event.request.headers || {};
            event.request.headers['X-AIMS-Auth-Token'] = this.getToken();
        }
    } );
    /**
    * Initialise whatever may be persisted
    */
    const persistedSession = this.storage.get("session") as AIMSSessionDescriptor;
    if ( persistedSession && persistedSession.hasOwnProperty( "authentication" ) && persistedSession.authentication.token_expiration >= this.getCurrentTimestamp() ) {
      try {
          this.setAuthentication(persistedSession);
      } catch( e ) {
          this.deactivateSession();
          console.warn(`Failed to reinstate session from localStorage: ${e.message}`, e );
      }
    } else {
      this.storage.destroy();
    }

    /* istanbul ignore next */
    AlGlobalizer.expose( 'al.session', {
        state: () => {
            return this.sessionData;
        },
        setActingAccount: ( accountId:string ) => {
            if ( ! this.isActive() ) {
                console.warn("The acting account cannot be changed while in an unauthenticated state." );
                return;
            }
            this.setActingAccount( accountId )
                  .then(  result => {
                              console.log("OK");
                          },
                          error => {
                              console.warn("Failed to set the acting account", error );
                          } );
        },
        modifyEntitlements: ( commandSequence:string ) => {
            //  This allows dynamic tweaking of entitlements using an economical sequence of string commands
            let records:AlEntitlementRecord[] = [];
            commandSequence.split(",").forEach( command => {
                if ( command.startsWith( "+") ) {
                    records.push( { productId: command.substring( 1 ), active: true, expires: new Date( 8640000000000000 ) } );
                } else if ( command.startsWith( "-" ) ) {
                    records.push( { productId: command.substring( 1 ), active: false, expires: new Date( 8640000000000000 ) } );
                } else {
                    console.warn(`Warning: don't know how to interpret '${command}'; ignoring` );
                }
            } );
            this.resolutionGuard.then( () => {
                try {
                  this.notifyStream.trigger( new AlActingAccountChangedEvent( this.sessionData.acting, this.sessionData.acting, this ) );
                  this.resolvedAccount.entitlements.merge( records );
                  this.notifyStream.trigger( this.resolvedAccount );
                } catch( e ) {
                  console.warn( e );
                }
            } );
        }
    } );
  }

  public reset( flushClientCache:boolean = false ) {
    if ( this.isActive() ) {
      this.deactivateSession();
    }
    AlLocatorService.reset();
    if ( flushClientCache ) {
      ALClient.reset();
    }
  }

  public setOptions( options:AlSessionOptions ) {
    this.options = Object.assign( this.options, options );
  }

  public async authenticate( username:string, passphrase:string, mfaCode?:string ):Promise<boolean> {
    return new Promise<boolean>( ( resolve, reject ) => {
      this.client.authenticate( username, passphrase, mfaCode )
        .then(  session => {
                  this.setAuthentication( session );
                  resolve( true );
                },
                error => reject( error ) );
    } );
  }

  public authenticateWithSessionToken( sessionToken:string, mfaCode:string ):Promise<boolean> {
    return new Promise<boolean>( ( resolve, reject ) => {
      this.client.authenticateWithMFASessionToken( sessionToken, mfaCode )
        .then(  session => {
                  this.setAuthentication( session );
                  resolve( true );
                },
                error => reject( error ) );
    } );
  }

  public async authenticateWithAccessToken( accessToken:string ):Promise<boolean> {
    return AIMSClient.getTokenInfo( accessToken ).then( tokenInfo => {
      let session:AIMSSessionDescriptor = {
        authentication: {
          account: tokenInfo.account,
          user: tokenInfo.user,
          token: accessToken,
          token_expiration: tokenInfo.token_expiration
        }
      };
      this.setAuthentication( session );
      return true;
    } );
  }

  /**
   * Sets and persists session data and begins account metadata resolution.
   *
   * Successful completion of this action triggers an AlSessionStartedEvent so that non-causal elements of an application can respond to
   * the change of state.
   */
  setAuthentication( proposal: AIMSSessionDescriptor ) {
    try {
      this.validateSessionDescriptor( proposal );
    } catch( e ) {
      console.error("Failed to set authentication with malformed data: ", proposal );
      throw e;
    }

    if ( proposal.authentication.token_expiration <= this.getCurrentTimestamp()) {
      throw new AlResponseValidationError( "AIMS authentication response contains unexpected expiration timestamp in the past" );
    }

    // Now that the content of the authentication session descriptor has been validated, let's make it effective
    Object.assign( this.sessionData.authentication.user, proposal.authentication.user );
    Object.assign( this.sessionData.authentication.account, proposal.authentication.account );
    this.sessionData.authentication.token = proposal.authentication.token;
    this.sessionData.authentication.token_expiration = proposal.authentication.token_expiration;
    this.activateSession();
    if ( proposal.acting ) {
        this.setActingAccount( proposal.acting );
    } else {
        this.setActingAccount( proposal.authentication.account );
    }
    this.storage.set("session", this.sessionData );
  }

  /**
   * Sets the session's acting account.
   *
   * Successful completion of this action triggers an AlActingAccountChangedEvent so that non-causal elements of an application can respond to
   * the change of effective account and entitlements.
   *
   * @param {AIMSAccount} The AIMSAccount object representating the account to focus on.
   *
   * @returns A promise that resolves
   */
  public setActingAccount( account: string|AIMSAccount ):Promise<AlActingAccountResolvedEvent> {

    if ( ! account ) {
      throw new Error("Usage error: setActingAccount requires an account ID or account descriptor." );
    }
    if ( typeof( account ) === 'string' ) {
      return AIMSClient.getAccountDetails( account ).then( accountDetails => {
        return this.setActingAccount( accountDetails );
      } );
    }

    const previousAccount               = this.sessionData.acting;
    const actingAccountChanged          = ! this.sessionData.acting || this.sessionData.acting.id !== account.id;

    this.sessionData.acting             = account;

    const targetLocationId              = account.accessible_locations.indexOf( this.sessionData.boundLocationId ) !== -1
                                            ? this.sessionData.boundLocationId
                                            : account.default_location;
    this.setActiveDatacenter( targetLocationId );

    ALClient.defaultAccountId           = account.id;

    if ( ! this.options.resolveAccountMetadata ) {
      this.resolvedAccount = new AlActingAccountResolvedEvent( account, null, null );
      return Promise.resolve( this.resolvedAccount );
    }

    if ( actingAccountChanged || ! this.resolutionGuard.isFulfilled() ) {
      this.resolutionGuard.rescind();
      AlLocatorService.setContext( {
          insightLocationId: this.sessionData.boundLocationId,
          accessible: account.accessible_locations
      } );
      this.notifyStream.trigger( new AlActingAccountChangedEvent( previousAccount, this.sessionData.acting, this ) );
      this.storage.set("session", this.sessionData );
      return this.resolveActingAccount( account );
    } else {
      return Promise.resolve( this.resolvedAccount );
    }
  }

  /**
   * Sets the 'active' datacenter.  This provides a default residency and API stack to interact with.
   */
  public setActiveDatacenter( insightLocationId:string ) {
    if ( ! this.sessionData.boundLocationId || insightLocationId !== this.sessionData.boundLocationId ) {
      this.sessionData.boundLocationId = insightLocationId;
      AlLocatorService.setContext( { insightLocationId } );
      this.storage.set( "session", this.sessionData );
      if ( AlInsightLocations.hasOwnProperty( insightLocationId ) ) {
          const metadata = AlInsightLocations[insightLocationId];
          this.notifyStream.trigger( new AlActiveDatacenterChangedEvent( insightLocationId, metadata.residency, metadata ) );
      }
    }
  }

  /**
   * Retrieves the 'active' datacenter, falling back on the acting account's or primary account's default_location
   * as necessary.
   */
  public getActiveDatacenter() {
    if ( this.isActive() ) {
      if ( this.sessionData.boundLocationId ) {
        return this.sessionData.boundLocationId;
      }
      if ( this.sessionData.acting ) {
        return this.sessionData.acting.default_location;
      }
      if ( this.sessionData.authentication && this.sessionData.authentication.account ) {
        return this.sessionData.authentication.account.default_location;
      }
    }
    return null;
  }

  /**
   * Convenience function to set token and expiry values
   * Modelled on /aims/v1/:account_id/account
   * To be called by AIMS Service
   */
  setTokenInfo(token: string, tokenExpiration: number) {
    this.sessionData.authentication.token = token;
    this.sessionData.authentication.token_expiration = tokenExpiration;
    this.storage.set("session", this.sessionData );
  }

  /**
   * Activate Session
   */
  activateSession(): boolean {
    const wasActive = this.sessionIsActive;
    if ( this.sessionData.authentication.token_expiration > this.getCurrentTimestamp()) {
      this.sessionIsActive = true;
    }
    if ( this.sessionIsActive && ! wasActive ) {
        this.notifyStream.tap();        //  *always* get notifyStream flowing at this point, so that we can intercept AlBeforeRequestEvents
        this.notifyStream.trigger( new AlSessionStartedEvent( this.sessionData.authentication.user, this.sessionData.authentication.account ) );
    }
    return this.isActive();
  }

  /**
   * Deactivate Session
   */
  deactivateSession(): boolean {
    this.sessionData = JSON.parse(JSON.stringify(AlNullSessionDescriptor));
    this.sessionIsActive = false;
    this.storage.destroy();
    this.notifyStream.trigger( new AlSessionEndedEvent( this ) );
    ALClient.defaultAccountId = null;
    return this.isActive();
  }

  /**
   * Is the Session Active?
   */
  isActive(): boolean {
    return this.sessionIsActive;
  }

  /**
   * Get Session
   */
  getSession(): AIMSSessionDescriptor {
    return this.sessionData;
  }

  /**
   * Get Authentication
   */
  getAuthentication(): AIMSAuthentication {
    return this.sessionData.authentication;
  }

  /*
   * Gets the ID of the primary account, the one the acting user belongs to.
   */
  getPrimaryAccountId(): string {
      return this.isActive() ? this.sessionData.authentication.account.id : null;
  }

  /*
   * Gets the primary account
   */
  getPrimaryAccount(): AIMSAccount {
      return this.sessionData.authentication.account;
  }

  /**
   * Get the ID of the acting account (account the user is currently working in)
   */
  getActingAccountId(): string {
      return this.isActive() ? this.sessionData.acting.id : null;
  }

  /**
   * Get acting Account Name - (account the user is currently working in)
   */
  getActingAccountName(): string {
    return this.sessionData.acting.name;
  }

  /**
   * Get Default Location for the acting account
   */
  getActingAccountDefaultLocation() {
    return this.sessionData.acting.default_location;
  }

  /**
   * Get Accessible Locations for the acting account
   */
  getActingAccountAccessibleLocations(): string[] {
    return this.sessionData.acting.accessible_locations;
  }

  /**
   * Get the acting account entity in its entirety
   */
  getActingAccount(): AIMSAccount {
    return this.sessionData.acting;
  }

  /**
   * Get Token
   */
  getToken(): string {
    return this.sessionData.authentication.token;
  }

  /**
   * Get Token Expiry
   */
  getTokenExpiry(): number {
    return this.sessionData.authentication.token_expiration;
  }

  /*
   * Returns the entire acting user record
   */
  getUser(): AIMSUser {
    return this.sessionData.authentication.user;
  }

  /**
   * Get User ID
   */
  getUserId(): string {
    return this.sessionData.authentication.user.id;
  }

  /**
   * Get User Name
   */
  getUserName(): string {
    return this.sessionData.authentication.user.name;
  }

  /**
   * Get User Email
   */
  getUserEmail(): string {
    return this.sessionData.authentication.user.email;
  }

  /**
   * @deprecated
   * Alias for getActingAccountId
   */
  getActingAccountID(): string {
      return this.getActingAccountId();
  }

  /*
   * @deprecated
   * Alias for `getUserId`
   */
  getUserID(): string {
    return this.sessionData.authentication.user.id;
  }

  /**
   * @deprecated
   * Please use `getPrimaryAccountId()` instead
   */
  getUserAccountID(): string {
    return this.sessionData.authentication.account.id;
  }

  /**
   * @deprecated
   * Get Accessible Locations for the users account
   */
  getUserAccessibleLocations(): string[] {
    return this.sessionData.authentication.account.accessible_locations;
  }

  /**
   * Convenience method to wait until authentication status and metadata have been resolved.
   *
   * PLEASE NOTE: that this async function will not resolve until authentication is complete and subscriptions metadata
   * has been retrieved and collated; in an unauthenticated context, it will never resolve!
   */
  public async resolved(): Promise<void> {
    return this.resolutionGuard.then( () => {} );
  }

  /**
   * Convenience method to retrieve the entitlements for the primary account.
   * See caveats for `ALSession.authenticated` method, which also apply to this method.
   */
  public async getPrimaryEntitlements():Promise<AlEntitlementCollection> {
    return this.resolutionGuard.then( () => this.primaryEntitlements );
  }

  /**
   * Convenience method to retrieve the entitlements for the current acting account.
   * See caveats for `ALSession.authenticated` method, which also apply to this method.
   */
  public async getEffectiveEntitlements():Promise<AlEntitlementCollection> {
    return this.resolutionGuard.then( () => this.resolvedAccount.entitlements );
  }

  /**
   * Convenience method to retrieve the array of accounts managed by the current acting account.
   * See caveats for `ALSession.authenticated` method, which also apply to this method.
   */
  public async getManagedAccounts():Promise<AIMSAccount[]> {
    return this.resolutionGuard.then( () => this.resolvedAccount.managedAccounts );
  }

  /**
   * Private Internal/Utility Methods
   */

  /**
   * Get the current timestamp (seconds since the epoch)
   */
  protected getCurrentTimestamp(): number {
    return new Date().getTime() / 1000;
  }

  /**
   * A utility method to resolve a partially populated AlActingAccountResolvedEvent instance.
   *
   * This method will retrieve the full account details, managed accounts, and entitlements for this account
   * and then emit an AlActingAccountResolvedEvent through the session's notifyStream.
   */
  protected async resolveActingAccount( account:AIMSAccount ) {
    const resolved:AlActingAccountResolvedEvent = new AlActingAccountResolvedEvent( account, null, null );
    let dataSources:Promise<any>[] = [
        AIMSClient.getAccountDetails( account.id ),
        AIMSClient.getManagedAccounts( this.getPrimaryAccountId(), { active: "true" } ),
        SubscriptionsClient.getEntitlements( this.getPrimaryAccountId() ) ];

    if ( account.id !== this.getPrimaryAccountId() ) {
      dataSources.push( SubscriptionsClient.getEntitlements( account.id ) );
    }

    return Promise.all( dataSources )
            .then(  dataObjects => {
                      const account:AIMSAccount                           =   dataObjects[0];
                      const managedAccounts:AIMSAccount[]                 =   dataObjects[1];
                      const entitlements:AlEntitlementCollection          =   dataObjects[2];
                      let actingEntitlements:AlEntitlementCollection;
                      if ( dataObjects.length > 3 ) {
                        actingEntitlements                                =   dataObjects[3];
                      } else {
                        actingEntitlements                                =   entitlements;
                      }

                      resolved.actingAccount      =   account;
                      resolved.managedAccounts    =   managedAccounts;
                      this.primaryEntitlements    =   entitlements;
                      resolved.entitlements       =   actingEntitlements;
                      this.resolvedAccount        =   resolved;
                      this.resolutionGuard.resolve(true);
                      this.notifyStream.trigger( resolved );

                      return resolved;
                    },
                    error => {
                      console.error(`Error: could not resolve the acting account to "${account.id}"`, error );
                      return Promise.reject( error );
                    } );
  }

  protected async resolveActingAccountConsolidated( account:AIMSAccount ) {
    const request = {
      service_stack: AlLocation.GestaltAPI,
      service_name: undefined,
      version: undefined,
      path: `/account/${account.id}/metadata`,
      retry_count: 4,
      retry_interval: 1000
    };
    try {
      let metadata = await ALClient.get( request ) as AlConsolidatedAccountMetadata;
      this.resolvedAccount = new AlActingAccountResolvedEvent( metadata.actingAccount, metadata.managedAccounts, AlEntitlementCollection.import( metadata.effectiveEntitlements ) );
      this.resolutionGuard.resolve( true );
      this.notifyStream.trigger( this.resolvedAccount );
      return this.resolvedAccount;
    } catch( e ) {
      console.warn("Failed to retrieve consolidated account metadata: falling back to default resolution method.", e );
      return this.resolveActingAccount( account );
    }
  }

  /**
   * This is a vastly simplified version of the json schema validator provided by AJV.  It isn't as thorough -- it doesn't descend into the 3rd tier of data structures
   * or lower -- but it should be sufficient to validate that the right entities are being provided, and not require so many extraneous packages.
   */
  protected validateSessionDescriptor( descriptor:any ):void {
    const requireProps = ( target:any, properties:{[propName:string]:string}, jsonPath:string = '.' ) => {
      Object.entries( properties ).forEach( ( [ propName, propType ] ) => {
        if ( ! target.hasOwnProperty( propName ) || typeof( target[propName] ) !== propType ) {
          throw new AlResponseValidationError( `The provided data does not match the schema for a session descriptor: ${jsonPath}.${propName} is missing or of the wrong type.` );
        }
      } );
    };
    if ( ! descriptor || ! descriptor.authentication ) {
      throw new AlResponseValidationError("The provided data does not match the schema for a session descriptor" );
    }
    requireProps( descriptor.authentication, { 'token': 'string', 'token_expiration': 'number', 'user': 'object', 'account': 'object' }, '.authentication' );
    requireProps( descriptor.authentication.user,
                  {
                    "id": "string",
                    "name": "string",
                    "email": "string",
                    "linked_users": "object",
                    "created": "object",
                    "modified": "object"
                  },
                  '.authentication.user' );
    requireProps( descriptor.authentication.account,
                  {
                    "id": "string",
                    "name": "string",
                    "accessible_locations": "object",
                    "default_location": "string",
                    "created": "object",
                    "modified": "object"
                  },
                  '.authentication.account' );
  }
}

/*  tslint:disable:variable-name */
export const AlSession = AlGlobalizer.instantiate( "AlSession", () => new AlSessionInstance() );

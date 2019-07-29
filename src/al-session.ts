/**
 * An interface for establishing and persistenting an authenticated AIMS session.
 *
 * @author Barry Skidmore <bskidmore@alertlogic.com>
 * @author Robert Parker <robert.parker@alertlogic.com>
 * @author Kevin Nielsen <knielsen@alertlogic.com>
 *
 * @copyright 2019 Alert Logic, Inc.
 */

import localStorageFallback from 'local-storage-fallback';
import { AlTriggerStream, AlTriggeredEvent } from '@al/haversack/triggers';
import { AlGlobalizer, AlStopwatch } from '@al/haversack/utility';
import { AlBehaviorPromise } from '@al/haversack/promises';
import { AlSchemaValidator } from '@al/haversack/schema-validator';
import { AlResponseValidationError } from '@al/haversack/errors';
import { AlSessionStartedEvent, AlSessionEndedEvent, AlActingAccountChangedEvent, AlActingAccountResolvedEvent } from './events';
import {
  AlChangeStamp, AIMSAuthentication, AIMSUser, AIMSAccount, AIMSSessionDescriptor,      /* core AIMS types */
  AlApiClient, AlDefaultClient,
  AIMSJsonSchematics,
  AlClientBeforeRequestEvent,
  ALClient
} from '@al/client';
import { AIMSClient } from '@al/aims';
import { AlEntitlementCollection, SubscriptionsClient } from '@al/subscriptions';
import { AlNullSessionDescriptor } from './null-session';


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

  constructor( client:AlApiClient = null ) {
    this.client = client || AlDefaultClient;
    this.notifyStream.siphon( this.client.events );
    this.notifyStream.attach( "AlClientBeforeRequest", ( event:AlClientBeforeRequestEvent ) => {
        if ( this.sessionIsActive ) {
            event.request.headers = event.request.headers || {};
            event.request.headers['X-AIMS-Auth-Token'] = this.getToken();
        }
    } );
    /**
    * Initialise whatever may be persisted
    */
    const persistedSession = this.getStorage();
    if ( persistedSession && persistedSession.hasOwnProperty( "authentication" ) && persistedSession.authentication.token_expiration >= this.getCurrentTimestamp() ) {
      try {
          this.setAuthentication(persistedSession);
      } catch( e ) {
          this.deactivateSession();
          console.warn(`Failed to reinstate session from localStorage: ${e.message}`, e );
      }
    } else {
        localStorageFallback.removeItem('al_session');
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
        }
    } );
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
  setAuthentication(proposal: AIMSSessionDescriptor) {
    let validator = new AlSchemaValidator<AIMSSessionDescriptor>();
    try {
      proposal = validator.validate( proposal, [ AIMSJsonSchematics.Authentication, AIMSJsonSchematics.Common ] );
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
    this.setStorage();
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

    const previousAccount = this.sessionData.acting;
    const actingAccountChanged = ! this.sessionData.acting || this.sessionData.acting.id !== account.id;

    this.sessionData.acting = account;
    ALClient.defaultAccountId = account.id;

    if ( actingAccountChanged || ! this.resolutionGuard.isFulfilled() ) {
      this.resolutionGuard.rescind();
      this.notifyStream.trigger( new AlActingAccountChangedEvent( previousAccount, this.sessionData.acting, this ) );
      this.setStorage();
      return this.resolveActingAccount( account );
    } else {
      return Promise.resolve( this.resolvedAccount );
    }
  }

  /**
   * Convenience function to set token and expiry values
   * Modelled on /aims/v1/:account_id/account
   * To be called by AIMS Service
   */
  setTokenInfo(token: string, tokenExpiration: number) {
    this.sessionData.authentication.token = token;
    this.sessionData.authentication.token_expiration = tokenExpiration;
    this.setStorage();
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
    localStorageFallback.removeItem('al_session');
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
   * Get the ID of the acting account
   */
  getActingAccountId(): string {
      return this.isActive() ? this.sessionData.acting.id : null;
  }

  /**
   * Get the acting account
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

  /**
   * Get User ID
   */
  getUserID(): string {
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
   * Get Account ID - For which the User belongs to
   */
  getUserAccountID(): string {
    return this.sessionData.authentication.account.id;
  }

  /**
   * Get acting Account ID - (account the user is currently working in)
   */
  getActingAccountID(): string {
    return this.sessionData.acting.id;
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
        AIMSClient.getManagedAccounts( this.getPrimaryAccountId() ),
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
                    } );
  }


  /**
   * Persist our session
   */
  private setStorage() {
    if (this.sessionIsActive && this.sessionData && this.sessionData.hasOwnProperty( "authentication" ) ) {
      localStorageFallback.setItem('al_session', JSON.stringify(this.sessionData));
    }
  }

  /**
   * Fetch persisted session
   */
  private getStorage() {
    return JSON.parse(localStorageFallback.getItem('al_session'));
  }
}

/*  tslint:disable:variable-name */
export const AlSession = AlGlobalizer.instantiate( "AlSession", () => new AlSessionInstance() );

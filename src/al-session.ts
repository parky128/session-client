/**
 * Module for maintaining Alert Logic session data
 */

import localStorageFallback from 'local-storage-fallback';
import { AlSessionStartedEvent, AlSessionEndedEvent, AlActingAccountChangedEvent } from './events';
import {
  AlChangeStamp, AIMSAuthentication, AIMSUser, AIMSAccount, AIMSSessionDescriptor,      /* core AIMS types */
  AlApiClient, AlDefaultClient,
  AlSchemaValidator,
  AIMSJsonSchematics,
  AlResponseValidationError,
  AlTriggerStream,
  AlClientBeforeRequestEvent
} from '@al/client';

/**
 * Create our default session object
 */
/* tslint:disable:variable-name */
const AlDefaultSessionData: AIMSSessionDescriptor = {
    authentication: {
      user: {
        id: '0',
        name: 'Unauthenticated User',
        email: 'unauthenticated_user@unknown.com',
        active: false,
        locked: true,
        version: 1,
        created: {
          at: 0,
          by: '',
        },
        modified: {
          at: 0,
          by: '',
        },
      },
      account: {
        id: '0',
        name: 'Unknown Company',
        active: false,
        accessible_locations: [],
        default_location: '',
        created: {
          at: 0,
          by: '',
        },
        modified: {
          at: 0,
          by: '',
        },
      },
      token: '',
      token_expiration: 0,
    },
    acting: {
      id: '0',
      name: 'Unknown Company',
      active: false,
      version: 1,
      accessible_locations: [],
      default_location: '',
      created: {
        at: 0,
        by: '',
      },
      modified: {
        at: 0,
        by: '',
      },
    },
};

/**
 * AlSessionInstance maintains session data for a specific session.
 */
export class AlSessionInstance
{
  public    client:AlApiClient;
  public    sessionIsActive = false;
  public    sessionData: AIMSSessionDescriptor = JSON.parse(JSON.stringify(AlDefaultSessionData));
  public    notifyStream:AlTriggerStream = new AlTriggerStream();

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
    const persistedSession = this.getStorage();
    if ( persistedSession && persistedSession.hasOwnProperty( "authentication" ) ) {
      this.setAuthentication(persistedSession);
    }
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

  /**
   * Update 'authentication'
   * Modeled on /aims/v1/authenticate
   * To be called by AIMS Service
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
    if ( proposal.acting ) {
        Object.assign( this.sessionData.acting, proposal.acting );
    } else {
        Object.assign( this.sessionData.acting, proposal.authentication.account );
    }
    this.sessionData.authentication.token = proposal.authentication.token;
    this.sessionData.authentication.token_expiration = proposal.authentication.token_expiration;
    this.activateSession();
    this.setStorage();
  }

  /**
   * Set the acting account for the current user
   * Modelled on /aims/v1/:account_id/account
   * To be called by AIMS Service
   */
  setActingAccount(account: AIMSAccount) {
    const actingAccountChanged = ! this.sessionData.acting || this.sessionData.acting.id !== account.id;
    this.sessionData.acting = account;
    this.setStorage();
    if ( actingAccountChanged ) {
      this.notifyStream.trigger( new AlActingAccountChangedEvent( this.sessionData.acting, this ) );
    }
  }

  /**
   * Resolves the acting account
   */
  resolveActingAccount( accountId:string ):Promise<AIMSAccount> {
      return new Promise<AIMSAccount>( ( resolve, reject ) => {
          resolve( null );
      } );
  }

  /**
   * Convenience function to set token and expiry values
   * Modelled on /aims/v1/:account_id/account
   * To be called by AIMS Service
   */
  setTokenInfo(token: string, tokenExpiration: number) {
    this.sessionData.authentication.token = token;
    this.sessionData.authentication.token_expiration = tokenExpiration;
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
        this.notifyStream.trigger( new AlSessionStartedEvent( this.sessionData.authentication.user, this.sessionData.authentication.account, this ) );
        this.notifyStream.trigger( new AlActingAccountChangedEvent( this.sessionData.acting, this ) );
    }
    return this.isActive();
  }

  /**
   * Deactivate Session
   */
  deactivateSession(): boolean {
    this.sessionData = JSON.parse(JSON.stringify(AlDefaultSessionData));
    this.sessionIsActive = false;
    localStorageFallback.removeItem('al_session');
    this.notifyStream.trigger( new AlSessionEndedEvent( this ) );
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
   * Private Internal/Utility Methods
   */

  /**
   * Get the current timestamp (seconds since the epoch)
   */
  getCurrentTimestamp(): number {
    return new Date().getTime() / 1000;
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
export const AlDefaultSession = new AlSessionInstance();

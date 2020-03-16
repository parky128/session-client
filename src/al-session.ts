/**
 * An interface for establishing and persistenting an authenticated AIMS session.
 *
 * @author Kevin Nielsen <knielsen@alertlogic.com>
 * @author Barry Skidmore <bskidmore@alertlogic.com>
 * @author Robert Parker <robert.parker@alertlogic.com>
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
import { AlConsolidatedAccountMetadata, AlExperienceTree } from './types';

export interface AlSessionOptions {
    /**
     * Controls whether or not authentication resolves account metadata, like entitlements and managed accounts.  Defaults to `true`.
     */
    resolveAccountMetadata?:boolean;

    /**
     * If account metadata is resolved, should the client use the consolidated/gestalt resolver endpoint?  Defaults to `false`.
     */
    useConsolidatedResolver?:boolean;
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
    protected resolvedAccount                     =   new AlActingAccountResolvedEvent( null,
                                                                                        new AlEntitlementCollection(),
                                                                                        new AlEntitlementCollection(),
                                                                                        new AlExperienceTree() );
    protected managedAccounts:AIMSAccount[]       =   [];
    protected resolutionGuard                     =   new AlBehaviorPromise<boolean>();                                               //  This functions as a mutex so that access to resolvedAccount is only available at appropriate times
    protected storage                             =   AlCabinet.persistent( "al_session" );
    protected options:AlSessionOptions = {
        resolveAccountMetadata: true,
        useConsolidatedResolver: false
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
       * Attempt to recreate a persisted session.  Note that the timeout below (really just an execution deferral, given the 0ms) prevents any
       * API requests from being fired before whatever application has imported us has had a chance to bootstrap.
       */
      const persistedSession = this.storage.get("session") as AIMSSessionDescriptor;
      if ( persistedSession && persistedSession.hasOwnProperty( "authentication" ) && persistedSession.authentication.token_expiration >= this.getCurrentTimestamp() ) {
        setTimeout( () => {
                        try {
                            this.setAuthentication(persistedSession);
                        } catch( e ) {
                            this.deactivateSession();
                            console.warn(`Failed to reinstate session from localStorage: ${e.message}`, e );
                        }
                    },
                    0 );
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

    public async authenticate( username:string, passphrase:string, options:{actingAccount?:string|AIMSAccount,locationId?:string} = {} ):Promise<boolean> {
      return new Promise<boolean>( ( resolve, reject ) => {
        this.client.authenticate( username, passphrase, undefined, true )
          .then(  session => {
                    this.setAuthentication( session, options );
                    resolve( true );
                  },
                  error => reject( error ) );
      } );
    }

    public authenticateWithSessionToken( sessionToken:string, mfaCode:string, options:{actingAccount?:string|AIMSAccount,locationId?:string} = {} ):Promise<boolean> {
      return new Promise<boolean>( ( resolve, reject ) => {
        this.client.authenticateWithMFASessionToken( sessionToken, mfaCode, true )
          .then(  session => {
                    this.setAuthentication( session, options );
                    resolve( true );
                  },
                  error => reject( error ) );
      } );
    }

    public async authenticateWithAccessToken( accessToken:string, options:{actingAccount?:string|AIMSAccount,locationId?:string} = {} ):Promise<boolean> {
      return AIMSClient.getTokenInfo( accessToken ).then( tokenInfo => {
        let session:AIMSSessionDescriptor = {
          authentication: {
            account: tokenInfo.account,
            user: tokenInfo.user,
            token: accessToken,
            token_expiration: tokenInfo.token_expiration
          }
        };
        this.setAuthentication( session, options );
        return true;
      } );
    }

    /**
     * Sets and persists session data and begins account metadata resolution.
     *
     * Successful completion of this action triggers an AlSessionStartedEvent so that non-causal elements of an application can respond to
     * the change of state.
     */
    public async setAuthentication( proposal: AIMSSessionDescriptor, options:{actingAccount?:string|AIMSAccount,locationId?:string} = {} ):Promise<AlActingAccountResolvedEvent> {
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
      if ( options.locationId ) {
          this.sessionData.boundLocationId = options.locationId;
      }
      this.activateSession();
      let result:AlActingAccountResolvedEvent;
      if ( options.actingAccount ) {
          result = await this.setActingAccount( options.actingAccount );
      } else if ( proposal.acting ) {
          result = await this.setActingAccount( proposal.acting );
      } else {
          result = await this.setActingAccount( proposal.authentication.account );
      }
      this.storage.set("session", this.sessionData );
      return result;
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
    public async setActingAccount( account: string|AIMSAccount ):Promise<AlActingAccountResolvedEvent> {

      if ( ! account ) {
        throw new Error("Usage error: setActingAccount requires an account ID or account descriptor." );
      }
      if ( typeof( account ) === 'string' ) {
        const accountDetails = await AIMSClient.getAccountDetails( account );
        return await this.setActingAccount( accountDetails );
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
        //  If metadata resolution is disabled, still trigger changed/resolved events with basic data
          this.resolvedAccount = new AlActingAccountResolvedEvent( account, new AlEntitlementCollection(), new AlEntitlementCollection(), new AlExperienceTree() );
        this.notifyStream.trigger( new AlActingAccountChangedEvent( previousAccount, account, this ) );
        this.resolutionGuard.resolve(true);
        this.notifyStream.trigger( this.resolvedAccount );
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
        return await this.options.useConsolidatedResolver
          ? this.resolveActingAccountConsolidated( account )
          : this.resolveActingAccount( account );
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
      if ( this.sessionIsActive ) {
        SubscriptionsClient.setInternalUser( this.getPrimaryAccountId() === "2" );
        if ( ! wasActive ) {
          this.notifyStream.tap();        //  *always* get notifyStream flowing at this point, so that we can intercept AlBeforeRequestEvents
          this.notifyStream.trigger( new AlSessionStartedEvent( this.sessionData.authentication.user, this.sessionData.authentication.account ) );
        }
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
     * Retrieves the primary account's entitlements, or null if there is no session.
     */
    public getPrimaryEntitlementsSync():AlEntitlementCollection|null {
      if ( ! this.sessionIsActive ) {
        return null;
      }
      return this.resolvedAccount.primaryEntitlements;
    }

    /**
     * Convenience method to retrieve the entitlements for the primary account.
     * See caveats for `ALSession.authenticated` method, which also apply to this method.
     */
    public async getPrimaryEntitlements():Promise<AlEntitlementCollection> {
      return this.resolutionGuard.then( () => this.getPrimaryEntitlementsSync() );
    }

    /**
     * Retrieves the acting account's entitlements, or null if there is no session.
     */
    public getEffectiveEntitlementsSync():AlEntitlementCollection|null {
      if ( ! this.sessionIsActive || ! this.resolvedAccount ) {
        return null;
      }
      return this.resolvedAccount.entitlements;
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
      return this.resolutionGuard.then( () => AIMSClient.getManagedAccounts( this.getActingAccountId(), { active: true } ) );
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
      const resolved:AlActingAccountResolvedEvent = new AlActingAccountResolvedEvent( account, null, null, null );
      let dataSources:Promise<any>[] = [
          AIMSClient.getAccountDetails( account.id ),
          SubscriptionsClient.getEntitlements( this.getPrimaryAccountId() ) ];

      if ( account.id !== this.getPrimaryAccountId() ) {
        dataSources.push( SubscriptionsClient.getEntitlements( account.id ) );
      }

      return Promise.all( dataSources )
              .then(  dataObjects => {
                        const account:AIMSAccount                           =   dataObjects[0];
                        const primaryEntitlements:AlEntitlementCollection   =   dataObjects[1];
                        let actingEntitlements:AlEntitlementCollection;
                        if ( dataObjects.length > 2 ) {
                          actingEntitlements                                =   dataObjects[2];
                        } else {
                          actingEntitlements                                =   primaryEntitlements;
                        }

                        resolved.actingAccount      =   account;
                        resolved.primaryEntitlements=   primaryEntitlements;
                        resolved.entitlements       =   actingEntitlements;
                        resolved.experiences        =   new AlExperienceTree();
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
      let request = {
        service_stack: AlLocation.GestaltAPI,
        service_name: undefined,
        version: undefined,
          path: `/account/v1/${account.id}/metadata`,
        retry_count: 3,
        retry_interval: 1000
      };
      try {
        let metadata = await ALClient.get( request ) as AlConsolidatedAccountMetadata;
        let experiences = new AlExperienceTree( metadata.experiences );
        const resolved = new AlActingAccountResolvedEvent(
          metadata.actingAccount,
          AlEntitlementCollection.import( metadata.effectiveEntitlements ),
          AlEntitlementCollection.import( metadata.primaryEntitlements ),
          experiences
        );
        this.resolvedAccount = resolved;
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

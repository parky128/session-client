/**
 * Module for maintaining Alert Logic session data
 */

import localStorageFallback from 'local-storage-fallback';

interface UserTimeStamp {
  at?: number;
  by?: string;
}

export interface AIMSAuthentication {
  user?: AIMSUser;
  account?: AIMSAccount;
  token?: string;
  token_expiration?: number;
}

interface AIMSUser {
  id?: string;
  name?: string;
  email?: string;
  active?: boolean;
  locked?: boolean;
  version?: number;
  created?: UserTimeStamp;
  modified?: UserTimeStamp;
}

export interface AIMSAccount {
  id?: string;
  name?: string;
  active?: boolean;
  version?: number;
  accessible_locations?: string[];
  default_location?: string;
  mfa_required?: boolean;
  created?: UserTimeStamp;
  modified?: UserTimeStamp;
}

interface AIMSSession {
  authentication: AIMSAuthentication;
  acting: AIMSAccount;
}

/**
 * ALSessionInstance maintains session data for a specific session.
 */

export class ALSessionInstance
{
  constructor() {
    /**
    * Initialise whatever may be persisted
    */
    const persistedSession = this.getStorage();
    if (this.validateProperty(persistedSession, 'authentication')) {
      this.setAuthentication(persistedSession.authentication);
    }
    if (this.validateProperty(persistedSession, 'acting')) {
      this.setActingAccount(persistedSession.acting);
    }
    this.activateSession();
  }

  /**
   * Deal with an Active Session
   */
  sessionIsActive = false;

  /**
   * Create our default session object
   */
  defaultSession: AIMSSession = {
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
  cacheSession: AIMSSession = JSON.parse(JSON.stringify(this.defaultSession));

  /**
   * Get the current timestamp
   */
  getTimestamp(): number {
    return new Date().getTime();
  }

  /**
   * Persist our session
   */
  private setStorage() {
    if (this.sessionIsActive) {
      if (this.validateProperty(this.cacheSession, 'authentication')) {
        if (this.validateProperty(this.cacheSession, 'acting')) {
          localStorageFallback.setItem('al_session', JSON.stringify(this.cacheSession));
        }
      }
    }
  }

  /**
   * Fetch persisted session
   */
  private getStorage() {
    return JSON.parse(localStorageFallback.getItem('al_session'));
  }

  /**
   * Validate that a property exists
   */
  private validateProperty(obj, key) {
    if (obj) {
      const hasProperty = Object.prototype.hasOwnProperty.call(obj, key);
      if (hasProperty) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update 'authentication'
   * Modelled on /aims/v1/authenticate
   * To be called by AIMS Service
   */
  setAuthentication(proposal: AIMSAuthentication) {
    if (this.validateProperty(proposal, 'user')) {
      if (this.validateProperty(proposal.user, 'id')) {
        this.cacheSession.authentication.user.id = proposal.user.id;
      }
      if (this.validateProperty(proposal.user, 'name')) {
        this.cacheSession.authentication.user.name = proposal.user.name;
      }
      if (this.validateProperty(proposal.user, 'email')) {
        this.cacheSession.authentication.user.email = proposal.user.email;
      }
      if (this.validateProperty(proposal.user, 'active')) {
        this.cacheSession.authentication.user.active = proposal.user.active;
      }
      if (this.validateProperty(proposal.user, 'locked')) {
        this.cacheSession.authentication.user.locked = proposal.user.locked;
      }
      if (this.validateProperty(proposal.user, 'version')) {
        this.cacheSession.authentication.user.version = proposal.user.version;
      }
      if (this.validateProperty(proposal.user, 'created')) {
        if (this.validateProperty(proposal.user.created, 'at')) {
          this.cacheSession.authentication.user.created.at = proposal.user.created.at;
        }
        if (this.validateProperty(proposal.user.created, 'by')) {
          this.cacheSession.authentication.user.created.by = proposal.user.created.by;
        }
      }
      if (this.validateProperty(proposal.user, 'modified')) {
        if (this.validateProperty(proposal.user.modified, 'at')) {
          this.cacheSession.authentication.user.modified.at = proposal.user.modified.at;
        }
        if (this.validateProperty(proposal.user.modified, 'by')) {
          this.cacheSession.authentication.user.modified.by = proposal.user.modified.by;
        }
      }
    }
    if (this.validateProperty(proposal, 'account')) {
      if (this.validateProperty(proposal.account, 'id')) {
        this.cacheSession.authentication.account.id = proposal.account.id;
      }
      if (this.validateProperty(proposal.account, 'name')) {
        this.cacheSession.authentication.account.name = proposal.account.name;
      }
      if (this.validateProperty(proposal.account, 'active')) {
        this.cacheSession.authentication.account.active = proposal.account.active;
      }
      if (this.validateProperty(proposal.account, 'accessible_locations')) {
        /* eslint-disable */
        this.cacheSession.authentication.account.accessible_locations = proposal.account.accessible_locations;
        /* eslint-enable */
      }
      if (this.validateProperty(proposal.account, 'default_location')) {
        /* eslint-disable */
        this.cacheSession.authentication.account.default_location = proposal.account.default_location;
        /* eslint-enable */
      }
      if (this.validateProperty(proposal.account, 'created')) {
        if (this.validateProperty(proposal.account.created, 'at')) {
          this.cacheSession.authentication.account.created.at = proposal.account.created.at;
        }
        if (this.validateProperty(proposal.account.created, 'by')) {
          this.cacheSession.authentication.account.created.by = proposal.account.created.by;
        }
      }
      if (this.validateProperty(proposal.account, 'modified')) {
        if (this.validateProperty(proposal.account.modified, 'at')) {
          this.cacheSession.authentication.account.modified.at = proposal.account.modified.at;
        }
        if (this.validateProperty(proposal.account.modified, 'by')) {
          this.cacheSession.authentication.account.modified.by = proposal.account.modified.by;
        }
      }
    }
    if ((proposal.token_expiration * 1000) > this.getTimestamp()) {
      this.cacheSession.authentication.token = proposal.token;
      this.cacheSession.authentication.token_expiration = proposal.token_expiration;
      this.activateSession();
    }
    this.setStorage();
    console.log("Cached session: ", this.cacheSession );
  }

  /**
   * Set the acting account for the current user
   * Modelled on /aims/v1/:account_id/account
   * To be called by AIMS Service
   */
  setActingAccount(account: AIMSAccount) {
    if (this.validateProperty(account, 'id')) {
      this.cacheSession.acting.id = account.id;
    }
    if (this.validateProperty(account, 'name')) {
      this.cacheSession.acting.name = account.name;
    }
    if (this.validateProperty(account, 'active')) {
      this.cacheSession.acting.active = account.active;
    }
    if (this.validateProperty(account, 'version')) {
      this.cacheSession.acting.version = account.version;
    }
    if (this.validateProperty(account, 'accessible_locations')) {
      this.cacheSession.acting.accessible_locations = account.accessible_locations;
    }
    if (this.validateProperty(account, 'default_location')) {
      this.cacheSession.acting.default_location = account.default_location;
    }
    if (this.validateProperty(account, 'created')) {
      if (this.validateProperty(account.created, 'at')) {
        this.cacheSession.acting.created.at = account.created.at;
      }
      if (this.validateProperty(account.created, 'by')) {
        this.cacheSession.acting.created.by = account.created.by;
      }
    }
    if (this.validateProperty(account, 'modified')) {
      if (this.validateProperty(account.modified, 'at')) {
        this.cacheSession.acting.modified.at = account.modified.at;
      }
      if (this.validateProperty(account.modified, 'by')) {
        this.cacheSession.acting.modified.by = account.modified.by;
      }
    }
    this.setStorage();
  }

  /**
   * Convenience function to set token and expiry values
   * Modelled on /aims/v1/:account_id/account
   * To be called by AIMS Service
   */
  setTokenInfo(token: string, tokenExpiration: number) {
    this.cacheSession.authentication.token = token;
    this.cacheSession.authentication.token_expiration = tokenExpiration;
  }

  /**
   * Activate Session
   */
  activateSession(): boolean {
    if ((this.cacheSession.authentication.token_expiration * 1000) > this.getTimestamp()) {
      this.sessionIsActive = true;
    }
    return this.isActive();
  }

  /**
   * Deactivate Session
   */
  deactivateSession(): boolean {
    this.cacheSession = JSON.parse(JSON.stringify(this.defaultSession));
    this.sessionIsActive = false;
    localStorageFallback.removeItem('al_session');
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
  getSession(): AIMSSession {
    return this.cacheSession;
  }

  /**
   * Get Authentication
   */
  getAuthentication(): AIMSAuthentication {
    return this.cacheSession.authentication;
  }

  /**
   * Get the acting account
   */
  getActingAccount(): AIMSAccount {
    return this.cacheSession.acting;
  }

  /**
   * Get Token
   */
  getToken(): string {
    return this.cacheSession.authentication.token;
  }

  /**
   * Get Token Expiry
   */
  getTokenExpiry(): number {
    return this.cacheSession.authentication.token_expiration;
  }

  /**
   * Get User ID
   */
  getUserID(): string {
    return this.cacheSession.authentication.user.id;
  }

  /**
   * Get User Name
   */
  getUserName(): string {
    return this.cacheSession.authentication.user.name;
  }

  /**
   * Get User Email
   */
  getUserEmail(): string {
    return this.cacheSession.authentication.user.email;
  }

  /**
   * Get Account ID - For which the User belongs to
   */
  getUserAccountID(): string {
    return this.cacheSession.authentication.account.id;
  }

  /**
   * Get acting Account ID - (account the user is currently working in)
   */
  getActingAccountID(): string {
    return this.cacheSession.acting.id;
  }

  /**
   * Get acting Account Name - (account the user is currently working in)
   */
  getActingAccountName(): string {
    return this.cacheSession.acting.name;
  }

  /**
   * Get Default Location for the acting account
   */
  getActingAccountDefaultLocation() {
    return this.cacheSession.acting.default_location;
  }

  /**
   * Get Accessible Locations for the acting account
   */
  getActingAccountAccessibleLocations(): string[] {
    return this.cacheSession.acting.accessible_locations;
  }

  /**
   * Get Accessible Locations for the users account
   */
  getUserAccessibleLocations(): string[] {
    return this.cacheSession.authentication.account.accessible_locations;
  }
}

export const ALSession = new ALSessionInstance();

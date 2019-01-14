/**
 * Module for maintaining Alert Logic session data
 */

const { storage } = require('local-storage-fallback');

const alSession = function alSession() {
  /**
   * Deal with persistent storage requirements
   */
  this.Storage = storage;

  /**
   * Deal with an Active Session
   */
  this.sessionIsActive = false;

  /**
   * Create our default session object
   */
  this.cacheSession = {
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
    active: {
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
   * Get the current timestamp
   */
  this.getTimestamp = function getTimestamp() {
    return new Date().getTime();
  };

  /**
   * Persist our session
   */
  this.setStorage = function setStorage() {
    if (this.sessionIsActive) {
      if (this.validateProperty(this.cacheSession, 'authentication')) {
        if (this.validateProperty(this.cacheSession, 'active')) {
          this.Storage.setItem('al_session', JSON.stringify(this.cacheSession));
        }
      }
    }
  };

  /**
   * Fetch persisted session
   */
  this.getStorage = function getStorage() {
    return JSON.parse(this.Storage.getItem('al_session'));
  };

  /**
   * Validate that a property exists
   */
  this.validateProperty = function validateProperty(obj, key) {
    if (obj) {
      const hasProperty = Object.prototype.hasOwnProperty.call(obj, key);
      if (hasProperty) {
        return true;
      }
    }
    return false;
  };

  /**
   * Update 'authentication'
   * Modelled on /aims/v1/authenticate
   * To be called by AIMS Service
   */
  this.setAuthentication = function setAuthentication(proposal) {
    if (proposal) {
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
          if (this.validateProperty(proposal.modified, 'by')) {
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
    }
  };

  /**
   * Update 'active'
   * Modelled on /aims/v1/:account_id/account
   * To be called by AIMS Service
   */
  this.setActive = function setActive(proposal) {
    if (proposal) {
      if (this.validateProperty(proposal, 'id')) {
        this.cacheSession.active.id = proposal.id;
      }
      if (this.validateProperty(proposal, 'name')) {
        this.cacheSession.active.name = proposal.name;
      }
      if (this.validateProperty(proposal, 'active')) {
        this.cacheSession.active.active = proposal.active;
      }
      if (this.validateProperty(proposal, 'version')) {
        this.cacheSession.active.version = proposal.version;
      }
      if (this.validateProperty(proposal, 'accessible_locations')) {
        this.cacheSession.active.accessible_locations = proposal.accessible_locations;
      }
      if (this.validateProperty(proposal, 'default_location')) {
        this.cacheSession.active.default_location = proposal.default_location;
      }
      if (this.validateProperty(proposal, 'created')) {
        if (this.validateProperty(proposal.created, 'at')) {
          this.cacheSession.active.created.at = proposal.created.at;
        }
        if (this.validateProperty(proposal.created, 'by')) {
          this.cacheSession.active.created.by = proposal.created.by;
        }
      }
      if (this.validateProperty(proposal, 'modified')) {
        if (this.validateProperty(proposal.modified, 'at')) {
          this.cacheSession.active.modified.at = proposal.modified.at;
        }
        if (this.validateProperty(proposal.modified, 'by')) {
          this.cacheSession.active.modified.by = proposal.modified.by;
        }
      }
      this.setStorage();
    }
  };

  /**
   * Convenience function to set token and expiry values
   * Modelled on /aims/v1/:account_id/account
   * To be called by AIMS Service
   */
  this.setTokenInfo = function setTokenInfo(token, tokenExpiration) {
    this.cacheSession.authentication.token = token;
    this.cacheSession.authentication.token_expiration = tokenExpiration;
  };

  /**
   * Activate Session
   */
  this.activateSession = function activateSession() {
    if ((this.cacheSession.authentication.token_expiration * 1000) > this.getTimestamp()) {
      this.sessionIsActive = true;
    }
    return this.isActive();
  };

  /**
   * Deactivate Session
   */
  this.deactivateSession = function deactivateSession() {
    this.cacheSession = {};
    this.sessionIsActive = false;
    this.Storage.removeItem('al_session');
    return this.isActive();
  };

  /**
   * Is the Session Active?
   */
  this.isActive = function isActive() {
    return this.sessionIsActive;
  };

  /**
   * Get Session
   */
  this.getSession = function getSession() {
    return this.cacheSession;
  };

  /**
   * Get Authentication
   */
  this.getAuthentication = function getAuthentication() {
    return this.cacheSession.authentication;
  };

  /**
   * Get Active Account
   */
  this.getActive = function getActive() {
    return this.cacheSession.active;
  };

  /**
   * Get Token
   */
  this.getToken = function getToken() {
    return this.cacheSession.authentication.token;
  };

  /**
   * Get Token Expiry
   */
  this.getTokenExpiry = function getTokenExpiry() {
    return this.cacheSession.authentication.token_expiration;
  };

  /**
   * Get User ID
   */
  this.getUserID = function getUserID() {
    return this.cacheSession.authentication.user.id;
  };

  /**
   * Get User Name
   */
  this.getUserName = function getUserName() {
    return this.cacheSession.authentication.user.name;
  };

  /**
   * Get User Email
   */
  this.getUserEmail = function getUserEmail() {
    return this.cacheSession.authentication.user.email;
  };

  /**
   * Get Account ID - For which the User belongs to
   */
  this.getUserAccountID = function getUserAccountID() {
    return this.cacheSession.authentication.account.id;
  };

  /**
   * Get acting Account ID - (account the user is currently working in)
   */
  this.getActiveAccountID = function getActiveAccountID() {
    return this.cacheSession.active.id;
  };

  /**
   * Get acting Account Name - (account the user is currently working in)
   */
  this.getActiveAccountName = function getActiveAccountName() {
    return this.cacheSession.active.name;
  };

  /**
   * Get Default Location for the active account
   */
  this.getDefaultLocation = function getDefaultLocation() {
    return this.cacheSession.active.default_location;
  };

  /**
   * Get Accessible Locations for the active account
   */
  this.getAccessibleLocations = function getAccessibleLocations() {
    return this.cacheSession.active.accessible_locations;
  };

  /**
   * Get Accessible Locations for the users account
   */
  this.getCurrentAccessibleLocations = function getCurrentAccessibleLocations() {
    return this.cacheSession.authentication.account.accessible_locations;
  };

  /**
   * Initialise whatever may be persisted
   */
  this.persistedSession = this.getStorage();
  if (this.validateProperty(this.persistedSession, 'authentication')) {
    this.setAuthentication(this.persistedSession.authentication);
  }
  if (this.validateProperty(this.persistedSession, 'active')) {
    this.setActive(this.persistedSession.active);
  }
  this.activateSession();
};

module.exports = alSession;

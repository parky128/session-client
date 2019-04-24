
import { ALSession, AIMSAuthentication, AIMSSession, AIMSAccount } from '../src/index';
import localStorageFallback from 'local-storage-fallback';
import { defaultSession, defaultActing } from './mocks/default-session.mock';
import { expect } from 'chai';
import { describe, before } from 'mocha';

describe('ALSession - AIMSAuthentication value persistance Test Suite:', () => {
  let authentication: AIMSSession;
  beforeEach(() => {
    authentication = {
      authentication: {
          user: {
            id: '12345-ABCDE',
            name: 'Alert Logic',
            email: 'alertlogic@unknown.com',
            active: true,
            locked: false,
            version: 1,
            created: {
              at: 0,
              by: 'ui-team',
            },
            modified: {
              at: 0,
              by: 'ui-team',
            },
          },
          account: {
            id: '2',
            name: 'Alert Logic',
            active: false,
            accessible_locations: ['location-a', 'location-b'],
            default_location: 'location-a',
            created: {
              at: 0,
              by: 'ui-team',
            },
            modified: {
              at: 0,
              by: 'ui-team',
            },
          },
          token: 'abig-fake.JUICY-token',
          token_expiration: + new Date() + 86400,
      }
    };
    ALSession.setAuthentication(authentication);
  });

  describe('After setting the authentication value of the session object', () => {
    it('should persist this to local storage"', () => {
      expect(JSON.parse(localStorageFallback.getItem('al_session')).authentication).to.deep.equal(authentication);
    });
  });
  describe('On retrieving the session token value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getToken()).to.equal(authentication.token);
    });
  });
  describe('On retrieving the session token expiry value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getTokenExpiry()).to.equal(authentication.token_expiration);
    });
  });
  describe('On retrieving the session user ID value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserID()).to.equal(authentication.user.id);
    });
  });
  describe('On retrieving the session user name value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserName()).to.equal(authentication.user.name);
    });
  });
  describe('On retrieving the session user email value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserEmail()).to.equal(authentication.user.email);
    });
  });
  describe('On retrieving the session user account ID value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserAccountID()).to.equal(authentication.account.id);
    });
  });
  describe('On retrieving the session AIMS Authentication value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getAuthentication()).to.deep.equal(authentication);
    });
  });
  describe('On retrieving the session user accessible locations', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserAccessibleLocations()).to.deep.equal(authentication.account.accessible_locations);
    });
  });
  describe('On setting the session token details', () => {
    it('should persisted these correctly', () => {
      const token = 'my-token.is-great';
      const tokenExpiry = + new Date() + 1000;
      ALSession.setTokenInfo(token, tokenExpiry);
      expect(ALSession.getToken()).to.equal(token);
      expect(ALSession.getTokenExpiry()).to.equal(tokenExpiry);
    });
  });
});

describe('ALSession - Acting AIMSAccount value persistance Test Suite:', () => {
  let actingAccount: AIMSAccount;
  beforeEach(() => {
    actingAccount = {
      id: '5',
      name: 'ACME Corp',
      active: false,
      version: 1,
      accessible_locations: ['location-a', 'location-b'],
      default_location: 'location-a',
      created: {
        at: 0,
        by: 'al-ui-team',
      },
      modified: {
        at: 0,
        by: 'al-ui-team',
      },
    };
    ALSession.setActingAccount(actingAccount);
  });
  describe('After setting the acting account value of the session object', () => {
    it('should persist this to local storage"', () => {
      expect(JSON.parse(localStorageFallback.getItem('al_session')).acting).to.deep.equal(actingAccount);
    });
  });
  describe('On retrieving the session acting account ID value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getActingAccountID()).to.equal(actingAccount.id);
    });
  });
  describe('On retrieving the session acting account name value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getActingAccountName()).to.equal(actingAccount.name);
    });
  });
  describe('On retrieving the session session acting account value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getActingAccount()).to.deep.equal(actingAccount);
    });
  });
  describe('On retrieving the acting account accessible locations', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getActingAccountAccessibleLocations()).to.equal(actingAccount.accessible_locations);
    });
  });
  describe('On retrieving the acting account default location', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getActingAccountDefaultLocation()).to.equal(actingAccount.default_location);
    });
  });
});

describe('After deactivating the session', () => {
  beforeEach(() => {
    ALSession.deactivateSession();
  });
  it('should set the value of the session back to the default', () => {
    expect(ALSession.getSession()).to.deep.equal(defaultSession);
  });
  it('should set remove the local storage item', () => {
    expect(localStorageFallback.getItem('al_session')).to.be.null;
  });
});

describe('When attempting to setAuthentication with', () => {
  describe('no user and account property provided', () => {
    it('should fallback to setting default values', () => {
      ALSession.setAuthentication({});
      expect(ALSession.getAuthentication()).to.deep.equal(defaultSession.authentication);
    });
  });
  describe('an empty user and account property provided', () => {
    it('should fallback to setting default values', () => {
      ALSession.setAuthentication({ user: { }, account: {} });
      expect(ALSession.getAuthentication()).to.deep.equal(defaultSession.authentication);
    });
  });
  describe('user and account properties BOTH containing empty created and modified properties', () => {
    it('should fallback to setting default values', () => {
      ALSession.setAuthentication({ user: { created: {}, modified: {} }, account: { created: {}, modified: {} } });
      expect(ALSession.getAuthentication()).to.deep.equal(defaultSession.authentication);
    });
  });
});

describe('When attempting to set with', () => {
  describe('no account property provided', () => {
    it('should fallback to setting default acting account values', () => {
      ALSession.setActingAccount({});
      expect(ALSession.getActingAccount()).to.deep.equal(defaultActing);
    });
  });
  describe('an account property provided that has empty created and modified properties', () => {
    it('should fallback to setting default acting account values', () => {
      ALSession.setActingAccount({ created: {}, modified: {} });
      expect(ALSession.getActingAccount()).to.deep.equal(defaultActing);
    });
  });
});

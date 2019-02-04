
import { ALSession, AIMSAuthentication, AIMSAccount } from '../src/index';
import localStorageFallback from 'local-storage-fallback';
import { defaultSession, defaultActive } from './mocks/default-session.mock';
import { expect } from 'chai';
import { describe, before } from 'mocha';

describe('ALSession - AIMSAuthentication value persistance Test Suite:', () => {
  let authentication: AIMSAuthentication;
  beforeEach(() => {
    authentication = {
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
      expect(ALSession.getCurrentAccessibleLocations()).to.deep.equal(authentication.account.accessible_locations);
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

describe('ALSession - Active AIMSAccount value persistance Test Suite:', () => {
  let activeAccount: AIMSAccount;
  beforeEach(() => {
    activeAccount = {
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
    ALSession.setActive(activeAccount);
  });
  describe('After setting the active account value of the session object', () => {
    it('should persist this to local storage"', () => {
      expect(JSON.parse(localStorageFallback.getItem('al_session')).active).to.deep.equal(activeAccount);
    });
  });
  describe('On retrieving the session active account ID value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getActiveAccountID()).to.equal(activeAccount.id);
    });
  });
  describe('On retrieving the session active account name value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getActiveAccountName()).to.equal(activeAccount.name);
    });
  });
  describe('On retrieving the session session active account value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getActive()).to.deep.equal(activeAccount);
    });
  });
  describe('On retrieving the session accessible locations', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getAccessibleLocations()).to.equal(activeAccount.accessible_locations);
    });
  });
  describe('On retrieving the session default location', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getDefaultLocation()).to.equal(activeAccount.default_location);
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
    it('should fallback to setting default active account values', () => {
      ALSession.setActive({});
      expect(ALSession.getActive()).to.deep.equal(defaultActive);
    });
  });
  describe('an account property provided that has empty created and modified properties', () => {
    it('should fallback to setting default active account values', () => {
      ALSession.setActive({ created: {}, modified: {} });
      expect(ALSession.getActive()).to.deep.equal(defaultActive);
    });
  });
});

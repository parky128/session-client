import { ALSession, AlSessionInstance } from '../src/index';
import { ALClient, AIMSSessionDescriptor, AIMSAccount, AlClientBeforeRequestEvent } from '@al/client';
import { AIMSClient } from '@al/aims';
import localStorageFallback from 'local-storage-fallback';
import { exampleSession, exampleActing } from './mocks/session-data.mocks';
import { expect, assert } from 'chai';
import { describe, before } from 'mocha';
import * as sinon from 'sinon';

describe('ALSession - AIMSAuthentication value persistance Test Suite:', () => {
  let sessionDescriptor;
  beforeEach(() => {
    sessionDescriptor = {
      authentication: {
          user: {
            id: '12345-ABCDE',
            name: 'Alert Logic',
            email: 'alertlogic@unknown.com',
            active: true,
            locked: false,
            version: 1,
            linked_users: [],
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
            mfa_required: false,
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
    ALSession.setAuthentication(sessionDescriptor);
  });

  describe('After setting the authentication value of the session object', () => {
    it('should persist this to local storage"', () => {
      expect(JSON.parse(localStorageFallback.getItem('al_session')).authentication).to.deep.equal(sessionDescriptor.authentication);
    });
  });
  describe('On retrieving the session token value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getToken()).to.equal(sessionDescriptor.authentication.token);
    });
  });
  describe('On retrieving the session token expiry value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getTokenExpiry()).to.equal(sessionDescriptor.authentication.token_expiration);
    });
  });
  describe('On retrieving the session user ID value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserID()).to.equal(sessionDescriptor.authentication.user.id);
    });
  });
  describe('On retrieving the session user name value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserName()).to.equal(sessionDescriptor.authentication.user.name);
    });
  });
  describe('On retrieving the session user email value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserEmail()).to.equal(sessionDescriptor.authentication.user.email);
    });
  });
  describe('On retrieving the session user account ID value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserAccountID()).to.equal(sessionDescriptor.authentication.account.id);
    });
  });
  describe('On retrieving the session AIMS Authentication value', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getAuthentication()).to.deep.equal(sessionDescriptor.authentication);
    });
  });
  describe('On retrieving the session user accessible locations', () => {
    it('should retrieve the persisted value', () => {
      expect(ALSession.getUserAccessibleLocations()).to.deep.equal(sessionDescriptor.authentication.account.accessible_locations);
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
  /** Disabled this because the session state may reflect annotations or artifacts of change that aren't included in the default session */
  it('should reflect that it has been deactivated', () => {
    expect(ALSession.isActive() ).to.equal( false );
  });
  it('should set remove the local storage item', () => {
    expect(localStorageFallback.getItem('al_session')).to.be.null;
  });
});

describe('AlSession', () => {
  describe("constructor", () => {
    afterEach( () => {
      localStorageFallback.removeItem( "al_session" );
    } );
    it( "should ignore expired session data on initialization", () => {
      let sessionDescriptor = {
        authentication: {
            user: {
              id: '12345-ABCDE',
              name: 'Alert Logic',
              email: 'alertlogic@unknown.com',
              active: true,
              locked: false,
              version: 1,
              linked_users: [],
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
              mfa_required: false,
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
            token_expiration: ( Date.now() / 1000 ) - ( 60 * 60 ),
        }
      };
      localStorageFallback.setItem("al_session", JSON.stringify( sessionDescriptor ) );
      let session = new AlSessionInstance();      //  sometimes it is easier to just not use singletons
      expect( session.isActive() ).to.equal( false );
      expect( localStorageFallback.getItem("al_session") ).to.equal( null );
    } );

    it( "should deactivate/clean storage if it is invalid", () => {
      //    The "prevent local storage tampering" test
      let badSession = {
        authentication: {
          token: exampleSession.authentication.token,
          token_expiration: exampleSession.authentication.token_expiration,
          user: Object.assign( {}, exampleSession.authentication.user ),
          account: "ABCD1234"      /*  this is incorrect structure */
        }
      };
      let warnStub = sinon.stub( console, 'warn' );
      let errorStub = sinon.stub( console, 'error' );
      localStorageFallback.setItem( "al_session", JSON.stringify( badSession ) );
      let session = new AlSessionInstance();
      expect( session.isActive() ).to.equal( false );
      expect( warnStub.callCount ).to.equal( 1 );
      //    Secondary test: make sure the AlClientBeforeRequest hook doesn't do anything funky
      let event = new AlClientBeforeRequestEvent( { url: 'https://api.cloudinsight.alertlogic.com', headers: {} } );
      session.notifyStream.trigger( event );
      expect( event.request.headers.hasOwnProperty( 'X-AIMS-Auth-Token' ) ).to.equal( false );
      warnStub.restore();
      errorStub.restore();
    } );

    it( "should authenticate localStorage if it is valid", () => {
      localStorageFallback.setItem( "al_session", JSON.stringify( exampleSession ) );
      let session = new AlSessionInstance();
      expect( session.isActive() ).to.equal( true );

      //    Secondary test: make sure the AlClientBeforeRequest hook works
      let event = new AlClientBeforeRequestEvent( { url: 'https://api.cloudinsight.alertlogic.com', headers: {} } );
      session.notifyStream.trigger( event );
      expect( event.request.headers.hasOwnProperty( 'X-AIMS-Auth-Token' ) ).to.equal( true );
      expect( event.request.headers['X-AIMS-Auth-Token'] ).to.equal( exampleSession.authentication.token );
    } );


  } );

  describe('when unauthenticated', () => {
    describe('account ID accessors', () => {
      it("should return NULL, rather than a string '0'", () => {
        let session:AlSessionInstance = new AlSessionInstance();
        //  Because returning '0' is stupid
        expect( session.getPrimaryAccountId() ).to.equal( null );
        expect( session.getActingAccountId() ).to.equal( null );
      } );
    } );
  } );

  describe('when authenticated', () => {

    let session:AlSessionInstance;

    beforeEach( () => {
      session = new AlSessionInstance();
      session.setAuthentication(exampleSession);
    } );

    describe('primary and acting accounts', () => {
      it( 'should return expected values', () => {
        let auth = session.getSession();
        expect( auth ).to.be.an( 'object' );
        expect( auth.authentication ).to.be.an( 'object' );
        expect( auth.authentication.token ).to.equal( exampleSession.authentication.token );

        expect( session.getPrimaryAccount() ).to.deep.equal( exampleSession.authentication.account );
        expect( session.getActingAccount() ).to.deep.equal( exampleSession.authentication.account );

        expect( session.getPrimaryAccountId() ).to.equal( exampleSession.authentication.account.id );
        expect( session.getActingAccountId() ).to.equal( exampleSession.authentication.account.id );

        session.deactivateSession();
      } );
    } );

  } );

  describe( 'authentication methods', () => {

    describe( 'by username and password', () => {

      it( "should authenticate properly given a valid client response", async () => {
        let session = new AlSessionInstance();
        let clientAuthStub = sinon.stub( ALClient, 'authenticate' ).returns( Promise.resolve( exampleSession ) );

        expect( session.isActive() ).to.equal( false );
        let result = await session.authenticate( "mcnielsen@alertlogic.com", "b1gB1rdL!ves!" );
        expect( session.isActive() ).to.equal( true );
        clientAuthStub.restore();
        session.deactivateSession();
      } );

    } );

    describe( 'by MFA code and session token', () => {

      it( "should authenticate properly given a valid client response", async () => {
        let session = new AlSessionInstance();
        let clientAuthStub = sinon.stub( ALClient, 'authenticateWithMFASessionToken' ).returns( Promise.resolve( exampleSession ) );

        expect( session.isActive() ).to.equal( false );
        let result = await session.authenticateWithSessionToken( "SOME_ARBITRARY_SESSION_TOKEN", "123456" );
        expect( session.isActive() ).to.equal( true );
        clientAuthStub.restore();
        session.deactivateSession();
      } );

    } );

    describe( 'by access token', () => {

      it( "should authenticate properly given a valid client response", async () => {
        let session = new AlSessionInstance();
        let clientAuthStub = sinon.stub( AIMSClient, 'getTokenInfo' ).returns( Promise.resolve( exampleSession.authentication ) );

        expect( session.isActive() ).to.equal( false );
        let result = await session.authenticateWithAccessToken( "SOME_ARBITRARY_ACCESS_TOKEN" );
        expect( session.isActive() ).to.equal( true );
        clientAuthStub.restore();
        session.deactivateSession();
      } );

    } );

  } );

} );

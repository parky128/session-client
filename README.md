  @al/session
=========

A client for maintaining [Alert Logic](https://www.alertlogic.com/) session data.

This library uses local-storage-fallback to provide transparent persistent storage to consumers.

## Disclaimer

Until the release of version 1.0.0 all current minor version increments may be backwards incompatible. Please bear this in mind when developing against this library. Should you have any further questions, please do not hesitate to contact us as [npm@alertlogic.com](mailto:npm@alertlogic.com)

Installation
---

      npm install @al/session --save

Usage
---

For commonjs environments, e.g nodejs:

      var ALSession = require('@al/session').ALSession;

For ES2015 environments, e.g. TypeScript based frameworks such as Angular:

      import { ALSession } from '@al/session';

Methods
---

**activateSession**

Sets isSessionActive to true if authentication.token_expiration is in the future.

      ALSession.activateSession();

**deactivateSession**

Sets isSessionActive to false and empties the cache of user and customer data.

      ALSession.deactivateSession();

**isSessionActive**

Boolean check to see if the session data itself is verified as potentially valid.

      ALSession.isSessionActive();

**setUserAuthentication**

Sets the authenticated user details

      ALSession.setUserAuthentication(proposal);

Takes a proposal parameter in the format of an authentication response object defintion from AIMS - [response format](https://console.account.alertlogic.com/users/api/aims/#api-AIMS_Authentication_and_Authorization_Resources-Authenticate)

**getUserAuthentication**

Returns currently logged in user's AIMS authentication object.
  
      ALSession.getUserAuthentication();

**setActive**

Sets the active account for the current authenticated user

      ALSession.setActive(proposal)

Takes a proposal parameter in the format of an authentication account object defintion from AIMS - [response format](https://console.account.alertlogic.com/users/api/aims/#api-AIMS_Authentication_and_Authorization_Resources-Authenticate)

**getActive**

Returns an AIMS authentication account details object for the current active account.

      ALSession.getActive();

**getToken**

Returns the current AIMS authentication token string.

      ALSession.getToken();

**getTokenExpiry**

Returns the current AIMS authentication token expiry.

      ALSession.getToken();

## Convenience methods for user

**getUserID**

**getUserName**

**getUserEmail**

**getUserAccountID**

**getCurrentAccessibleLocations**

## Convenience methods for active account

**getActiveAccountID**

**getActiveAccountName**

**getDefaultLocation**

**getAccessibleLocations**

## Interactive

Loads the library into memory and stays in an interactive node shell.
  
      npm run interactive

After running this command you can access the `ALSession` object and call methods directly on it.

## Tests

      npm test

or to watch for code changes and re-run tests:

      npm test-watch

An auto-generated `coverage` directory will be produced which will contain a browsable HTML report

## Contributing

The sources are written in Typescript and follow the tslint [airbnb](https://www.npmjs.com/package/tslint-config-airbnb) style.

## Building

To generate a production build

    npm run build

To generate a development build for local testing - non minified, concatenated only

    npm run build-dev

Builds will be be generated into a `dist` folder and will contain commonjs and umd bundles that will be consumed depending on the module system in whichever environment you are using.


  @alertlogic/session
=========

A service for maintaining [Alert Logic](https://www.alertlogic.com/) session data.

This library uses local-storage-fallback to provide transparent persistent storage to consumers.

## Disclaimer

Until the release of version 1.0.0 all current minor version increments may be backwards incompatible. Please bear this in mind when developing against this library. Should you have any further questions, please do not hesitate to contact us as [npm@alertlogic.com](mailto:npm@alertlogic.com)

## Installation

      npm install @alertlogic/session --save

## Usage

      var ALSession = require('@alertlogic/session').ALSession; //commonjs - e.g. node
      import { ALSession } from '@alertlogic/session'; //ES2015 - e.g. Angular, TS projects

  Sets isSessionActive to true if authentication.token_expiration is in the future.

      ALSession.activateSession()

  Sets isSessionActive to false and empties the cache of user and customer data.

      ALSession.deactivateSession()

  Test for true to see if the session data itself is verified as potentially valid.

      ALSession.isSessionActive()

  Accepts an AIMS authentication response.
  Proposal format: https://console.account.alertlogic.com/users/api/aims/#api-AIMS_Authentication_and_Authorization_Resources-Authenticate

      ALSession.setUserAuthentication(proposal)

  Returns an AIMS authentication object.
  
      ALSession.getUserAuthentication()

  Accepts an AIMS account details response.
  Proposal format: https://console.account.alertlogic.com/users/api/aims/#api-AIMS_Account_Resources-GetAccountDetails

      ALSession.setActiveCustomer(proposal)

  Returns an AIMS account details object.

      ALSession.getActiveCustomer()

  Returns an AIMS authentication.token string.

      ALSession.getToken()

## Interactive

  Loads the library into memory and stays in an interactive node shell.
  
      npm run interactive

  NOTE - You must build the sources before running this command, see Building section below

## Tests

      npm test

## Contributing

The sources are written in Typescript and follow the tslint airbnb style.

## Building

To generate a production build

    npm run build

To generate a development build

    npm run build-dev

Builds will be be generated into a `dist` folder and will contain commonjs and umd bundles that will be consumed depending on the module system in whichever environment you are using.


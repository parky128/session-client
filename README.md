  @alertlogic/session
=========

A service for maintaining [Alert Logic](https://www.alertlogic.com/) session data.

This library uses local-storage-fallback to provide transparent persistent storage to consumers.

## Disclaimer

Until the release of version 1.0.0 all current minor version increments may be backwards incompatible. Please bear this in mind when developing against this library. Should you have any further questions, please do not hesitate to contact us as [npm@alertlogic.com](mailto:npm@alertlogic.com)

## Installation

      npm install @alertlogic/session --save

## Usage

      var ALSession = require('@alertlogic/session');

  Sets isSessionActive to true if authentication.token_expiration is in the future.

        ALSession.activateSession()

  Sets isSessionActive to false and empties the cache of user and customer data.

      deactivateSession()

  Test for true to see if the session data itself is verified as potentially valid.

      isSessionActive()

  Accepts an AIMS authentication response.
  Proposal format: https://console.account.alertlogic.com/users/api/aims/#api-AIMS_Authentication_and_Authorization_Resources-Authenticate

      setUserAuthentication(proposal)

  Returns an AIMS authentication object.
  
      getUserAuthentication()

  Accepts an AIMS account details response.
  Proposal format: https://console.account.alertlogic.com/users/api/aims/#api-AIMS_Account_Resources-GetAccountDetails

      setActiveCustomer(proposal)

  Returns an AIMS account details object.

      getActiveCustomer()

  Returns an AIMS authentication.token string.

      getToken()

## Interactive

  Loads the library into memory and stays in an interactive node shell.
  
      npm run interactive

## Tests

  npm test

## Linting
  npm run lint

## Contributing

This repository follows the eslint airbnb style.

## Release History

* 0.1.0 Initial release

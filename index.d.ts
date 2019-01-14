// Type definitions for @alertlogic/session 0.1.0
// Project: https://github.com/alertlogic/session-client
// Definitions by: Rob Parker <https://github.com/parky128>

declare module '@alertlogic/session';

interface UserTimeStamp {
  at: number;
  by: string;
}

interface AIMSAuthentication {
  user: AIMSUser;
  account?: AIMSAccount;
  token: string;
  token_expiration: number;
}

interface AIMSUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  locked: boolean;
  version: number;
  created: UserTimeStamp;
  modified: UserTimeStamp;
}

interface AIMSAccount {
  id: string;
  name: string;
  active: boolean;
  version?: number;
  accessible_locations: Array<string>;
  default_location: string;
  mfa_required?: boolean;
  created: UserTimeStamp;
  modified: UserTimeStamp;
}

interface AIMSSession {
  authentication: AIMSAuthentication;
  active: AIMSAccount;
}
/**
 * Update 'authentication' session details
 * Modelled on /aims/v1/authenticate
 * To be called by AIMS Service
 */
export function setAuthentication(proposal: AIMSAuthentication): void;
/**
 * Update 'active' session details
 * Modelled on /aims/v1/:account_id/account
 * To be called by AIMS Service
 */
export function setActive(account: AIMSAccount): void;
/**
 * Activate Session
 */
export function activateSession(): boolean;
/**
 * Deactivate Session
 */
export function deactivateSession(): boolean;
/**
 * Is the Session Active?
 */
export function isActive(): boolean;
/**
 * Get full AIMS Session details
 */
export function getSession(): AIMSSession;
/**
 * Get Authentication session details
 */
export function getAuthentication(): AIMSAuthentication;
/**
 * Get Active Account details
 */
export function getActive(): AIMSAccount;
/**
 * Get AIMS Token
 */
export function getToken(): string;
/**
 * Get AIMS Token Expiry
 */
export function getTokenExpiry(): number;
/**
 * Get User ID
 */
export function getUserID(): string;
/**
 * Get User Name
 */
export function getUserName(): string;
/**
 * Get User Email
 */
export function getUserEmail(): string;
/**
 * Get User's Account ID - For which the User belongs to
 */
export function getUserAccountID(): string;
/**
 * Get active Account ID - (account the user is currently working in)
 */
export function getActiveAccountID(): string;
/**
 * Get active Account Name - (account the user is currently working in)
 */
export function getActiveAccountName(): string;
/**
 * Get Default Location for the active account
 */
export function getDefaultLocation(): string;
/**
 * Get Accessible Locations for the active account
 */
export function getAccessibleLocations(): Array<string>;
/**
 * Get Accessible Locations for the user's account
 */
export function getCurrentAccessibleLocations(): Array<string>;
/**
 * Get AIMS Token
 */
export function getToken(): string;
/**
 * Convenience function to set token and expiry values
 */
export function setTokenInfo(token: string, tokenExpiration: number) : void;

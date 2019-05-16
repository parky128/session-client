import { AlTriggeredEvent } from '@al/haversack/triggers';
import { AIMSUser, AIMSAccount } from '@al/client';
import { AlEntitlementCollection } from '@al/subscriptions';
import { AlSessionInstance } from '../al-session';

/**
 * AlSessionStartedEvent is broadcast by an AlSessionInstance whenever a new session is created by a successful authentication.
 */
export class AlSessionStartedEvent extends AlTriggeredEvent
{
    constructor( public user:AIMSUser,
                 public primaryAccount:AIMSAccount,
                 public session:AlSessionInstance ) {
        super( "AlSessionStarted" );
    }
}

/**
 * AlSessionEndedEvent is broadcast by an AlSessionInstance whenever an existing session is destroyed.
 */
export class AlSessionEndedEvent extends AlTriggeredEvent
{
    constructor( public session:AlSessionInstance ) {
        super( "AlSessionEnded" );
    }
}

/**
 * AlActingAccountChangedEvent is broadcast by an AlSessionInstance whenever the acting account is initially changed.
 * This event should be regarded as the *beginning* of the account change process, and provides attentive services to opportunity to
 * flush any account-specific stateful data and any views to evaluate whether they are still valid.
 */
export class AlActingAccountChangedEvent extends AlTriggeredEvent
{
    constructor( public actingAccount:AIMSAccount,
                 public session:AlSessionInstance ) {
        super( "AlActingAccountChanged" );
    }
}

/**
 * AlActingAccountResolvedEvent is broadcast by an AlSessionInstance whenever the acting account has been changed
 * and its roles, entitlements, and managed children have been retrieved from their respective services.  This event is the second half of the process
 * whose beginning is indicated by AlActingAccountChangedEvent.
 */
export class AlActingAccountResolvedEvent extends AlTriggeredEvent
{
    constructor( public actingAccount:AIMSAccount,
                 public managedAccounts:AIMSAccount[],
                 public entitlements:AlEntitlementCollection ) {
        super( "AlActingAccountResolved" );
    }
}

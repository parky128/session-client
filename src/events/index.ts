import { AlTriggeredEvent } from '@al/haversack/triggers';
import { AIMSUser, AIMSAccount } from '@al/client';
import { AlSessionInstance } from '../al-session';

/**
 * AlSessionStartedEvent is broadcast by an AlSessionInstance whenever a new session is created by a successful authentication.
 */
export class AlSessionStartedEvent extends AlTriggeredEvent
{
    constructor( public user:AIMSUser,
                 public primaryAccount:AIMSAccount,
                 public session:AlSessionInstance ) {
        super();
    }
}

/**
 * AlSessionEndedEvent is broadcast by an AlSessionInstance whenever an existing session is destroyed.
 */
export class AlSessionEndedEvent extends AlTriggeredEvent
{
    constructor( public session:AlSessionInstance ) {
        super();
    }
}

/**
 * AlActingAccountChangedEvent is broadcast by an AlSessionInstance whenever the acting account is changed.
 */
export class AlActingAccountChangedEvent extends AlTriggeredEvent
{
    constructor( public actingAccount:AIMSAccount,
                 public session:AlSessionInstance ) {
        super();
    }
}

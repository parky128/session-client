import { AlEndpointsServiceCollection } from '@al/client';
import { AIMSAccount, AIMSUser } from '@al/aims';
import { AlEntitlementRecord } from '@al/subscriptions';
import { AlExperienceNode } from './al-experience.types';

export interface AlConsolidatedAccountMetadata {
    user:AIMSUser;
    primaryAccount:AIMSAccount;
    actingAccount:AIMSAccount;
    managedAccounts?:AIMSAccount[];
    primaryEntitlements:AlEntitlementRecord[];
    effectiveEntitlements:AlEntitlementRecord[];
    experiences:AlExperienceNode;
    endpointsData:AlEndpointsServiceCollection;
}

export * from './al-experience.types';

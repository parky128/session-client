import { AlEndpointsServiceCollection } from '@al/client';
import { AIMSAccount, AIMSUser } from '@al/aims';
import { AlEntitlementRecord } from '@al/subscriptions';

export interface AlConsolidatedAccountMetadata {
    user:AIMSUser;
    primaryAccount:AIMSAccount;
    actingAccount:AIMSAccount;
    managedAccounts?:AIMSAccount[];
    primaryEntitlements:AlEntitlementRecord[];
    effectiveEntitlements:AlEntitlementRecord[];
    endpointsData:AlEndpointsServiceCollection;
}

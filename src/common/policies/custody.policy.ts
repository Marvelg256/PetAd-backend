import {
  CustodyPolicyResource,
  isAdmin,
  PolicyAction,
  PolicyActor,
  PolicySubject,
  ResourcePolicy,
} from './policy.types';

/**
 * Custody access rules.
 *
 * - ADMIN: full access.
 * - holder: read, update, return the pet and report a violation.
 * - pet owner: read, update and report a violation, but never return custody
 *   on the holder's behalf.
 * - everyone else: no access (surfaces as 404, never 403).
 */
export class CustodyPolicy implements ResourcePolicy<CustodyPolicyResource> {
  readonly subject = PolicySubject.CUSTODY;

  allows(
    actor: PolicyActor,
    custody: CustodyPolicyResource,
    action: PolicyAction,
  ): boolean {
    if (isAdmin(actor)) {
      return true;
    }

    const isHolder = custody.holderId === actor.userId;
    const isOwner = custody.pet?.currentOwnerId === actor.userId;

    if (!isHolder && !isOwner) {
      return false;
    }

    switch (action) {
      case PolicyAction.READ:
        return true;
      case PolicyAction.UPDATE:
        return isHolder || isOwner;
      case PolicyAction.RETURN:
        return isHolder;
      case PolicyAction.REPORT_VIOLATION:
        return isHolder || isOwner;
      default:
        return false;
    }
  }
}

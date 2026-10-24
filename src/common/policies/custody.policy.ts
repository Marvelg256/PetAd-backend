import {
  CustodyPolicyResource,
  isAdmin,
  PolicyAction,
  PolicyActor,
  PolicySubject,
  ResourcePolicy,
} from './policy.types';

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

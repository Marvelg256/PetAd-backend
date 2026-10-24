import {
  AdoptionPolicyResource,
  isAdmin,
  PolicyAction,
  PolicyActor,
  PolicySubject,
  ResourcePolicy,
} from './policy.types';

export class AdoptionPolicy implements ResourcePolicy<AdoptionPolicyResource> {
  readonly subject = PolicySubject.ADOPTION;

  allows(
    actor: PolicyActor,
    adoption: AdoptionPolicyResource,
    action: PolicyAction,
  ): boolean {
    if (isAdmin(actor)) {
      return true;
    }

    const isAdopter = adoption.adopterId === actor.userId;
    const isOwner = adoption.ownerId === actor.userId;

    if (!isAdopter && !isOwner) {
      return false;
    }

    switch (action) {
      case PolicyAction.READ:
      case PolicyAction.UPDATE:
      case PolicyAction.UPLOAD:
        return true;
      default:
        return false;
    }
  }
}

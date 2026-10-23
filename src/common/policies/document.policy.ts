import {
  DocumentPolicyResource,
  isAdmin,
  PolicyAction,
  PolicyActor,
  PolicySubject,
  ResourcePolicy,
} from './policy.types';

/**
 * Document access rules.
 *
 * - ADMIN: full access.
 * - uploader: read and delete their own upload.
 * - adoption parties (adopter / owner): read the documents attached to their
 *   adoption.
 * - everyone else: no access (surfaces as 404, never 403).
 */
export class DocumentPolicy implements ResourcePolicy<DocumentPolicyResource> {
  readonly subject = PolicySubject.DOCUMENT;

  allows(
    actor: PolicyActor,
    document: DocumentPolicyResource,
    action: PolicyAction,
  ): boolean {
    if (isAdmin(actor)) {
      return true;
    }

    const isUploader = document.uploadedById === actor.userId;
    const isParty =
      document.adoption?.adopterId === actor.userId ||
      document.adoption?.ownerId === actor.userId;

    if (!isUploader && !isParty) {
      return false;
    }

    switch (action) {
      case PolicyAction.READ:
        return true;
      case PolicyAction.DELETE:
        return isUploader;
      default:
        return false;
    }
  }
}

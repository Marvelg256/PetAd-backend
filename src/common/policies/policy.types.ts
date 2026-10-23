import { Role } from '../../auth/enums/role.enum';

/**
 * Actions that can be authorized against a loaded resource.
 * Kept aggregate-neutral so a single guard can serve every policy.
 */
export enum PolicyAction {
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  UPLOAD = 'UPLOAD',
  RETURN = 'RETURN',
  REPORT_VIOLATION = 'REPORT_VIOLATION',
}

/** Aggregates that have a resource-level policy. */
export enum PolicySubject {
  ADOPTION = 'ADOPTION',
  CUSTODY = 'CUSTODY',
  DOCUMENT = 'DOCUMENT',
}

/** The authenticated caller a policy decision is made for. */
export interface PolicyActor {
  userId: string;
  role: Role | string;
}

/** Metadata attached by @CheckPolicy and read by PoliciesGuard. */
export interface PolicyRequirement {
  action: PolicyAction;
  subject: PolicySubject;
  /** Route parameter that carries the resource id. Defaults to `id`. */
  param: string;
}

export interface AdoptionPolicyResource {
  id: string;
  adopterId: string;
  ownerId: string;
}

export interface CustodyPolicyResource {
  id: string;
  holderId: string;
  pet: { currentOwnerId: string | null } | null;
}

export interface DocumentPolicyResource {
  id: string;
  uploadedById: string;
  adoption: { adopterId: string; ownerId: string } | null;
}

export interface ResourcePolicy<TResource> {
  readonly subject: PolicySubject;
  allows(
    actor: PolicyActor,
    resource: TResource,
    action: PolicyAction,
  ): boolean;
}

const ADMIN_ROLE: string = Role.ADMIN;

export function isAdmin(actor: PolicyActor): boolean {
  return actor.role === ADMIN_ROLE;
}

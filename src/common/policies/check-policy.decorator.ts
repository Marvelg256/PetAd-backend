import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiNotFoundResponse } from '@nestjs/swagger';
import { PoliciesGuard } from '../guards/policies.guard';
import { PolicyAction, PolicyRequirement, PolicySubject } from './policy.types';

export const POLICY_KEY = 'resource-policy';

/**
 * Requires the caller to satisfy a resource-level policy before the handler
 * runs. The resource is loaded by PoliciesGuard using the caller's own
 * relationship to it, so foreign ids resolve to 404 instead of 403.
 *
 * @param action action being attempted (READ, UPDATE, UPLOAD, ...)
 * @param subject aggregate being protected (ADOPTION, CUSTODY, DOCUMENT)
 * @param param route parameter holding the resource id (defaults to `id`)
 */
export const CheckPolicy = (
  action: PolicyAction,
  subject: PolicySubject,
  param = 'id',
) =>
  applyDecorators(
    SetMetadata(POLICY_KEY, {
      action,
      subject,
      param,
    } satisfies PolicyRequirement),
    UseGuards(PoliciesGuard),
    ApiNotFoundResponse({ description: 'Resource not found' }),
  );

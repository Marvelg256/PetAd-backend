import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiNotFoundResponse } from '@nestjs/swagger';
import { PoliciesGuard } from '../guards/policies.guard';
import { PolicyAction, PolicyRequirement, PolicySubject } from './policy.types';

export const POLICY_KEY = 'resource-policy';

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

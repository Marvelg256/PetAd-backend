import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { POLICY_KEY } from '../policies/check-policy.decorator';
import { enforcePolicy } from '../policies/policy-loader';
import { PolicyActor, PolicyRequirement } from '../policies/policy.types';

interface PolicyRequest {
  user?: {
    sub?: string;
    userId?: string;
    role?: string;
  };
  params?: Record<string, string | undefined>;
}

function toActor(user: PolicyRequest['user']): PolicyActor | null {
  const userId = user?.sub ?? user?.userId;

  if (!userId) {
    return null;
  }

  return { userId, role: user?.role ?? 'USER' };
}

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      PolicyRequirement | undefined
    >(POLICY_KEY, [context.getHandler(), context.getClass()]);

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PolicyRequest>();
    const actor = toActor(request.user);

    if (!actor) {
      throw new UnauthorizedException('Authentication required');
    }

    const resourceId = request.params?.[requirement.param];

    if (!resourceId) {
      throw new NotFoundException('Resource not found');
    }

    await enforcePolicy(this.prisma, requirement, actor, resourceId);

    return true;
  }
}

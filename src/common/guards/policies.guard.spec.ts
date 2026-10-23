import {
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Role } from '../../auth/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { PoliciesGuard } from './policies.guard';
import {
  PolicyAction,
  PolicyRequirement,
  PolicySubject,
} from '../policies/policy.types';

function prismaNotFound(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('No record found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

function contextWith(
  user: Record<string, string> | undefined,
  id = 'adoption-1',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { id } }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PoliciesGuard', () => {
  let guard: PoliciesGuard;
  let reflector: Reflector;
  const prisma = {
    adoption: { findFirstOrThrow: jest.fn() },
    custody: { findFirstOrThrow: jest.fn() },
    document: { findFirstOrThrow: jest.fn() },
  };

  const requirement: PolicyRequirement = {
    action: PolicyAction.READ,
    subject: PolicySubject.ADOPTION,
    param: 'id',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = new Reflector();
    guard = new PoliciesGuard(reflector, prisma as unknown as PrismaService);
  });

  it('allows handlers without a policy requirement', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    await expect(guard.canActivate(contextWith(undefined))).resolves.toBe(true);
  });

  it('rejects unauthenticated callers', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requirement);

    await expect(guard.canActivate(contextWith(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lets a participant read their own adoption', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requirement);
    prisma.adoption.findFirstOrThrow.mockResolvedValue({
      id: 'adoption-1',
      adopterId: 'user-1',
      ownerId: 'owner-1',
    });

    const allowed = await guard.canActivate(
      contextWith({ sub: 'user-1', role: Role.USER }),
    );

    expect(allowed).toBe(true);
  });

  it("returns 404 when user A asks for user B's adoption", async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requirement);
    prisma.adoption.findFirstOrThrow.mockRejectedValue(prismaNotFound());

    await expect(
      guard.canActivate(contextWith({ sub: 'user-a', role: Role.USER })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes the lookup to the caller instead of loading then denying', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requirement);
    prisma.adoption.findFirstOrThrow.mockResolvedValue({
      id: 'adoption-1',
      adopterId: 'user-1',
      ownerId: 'owner-1',
    });

    await guard.canActivate(contextWith({ sub: 'user-1', role: Role.USER }));

    const [[lookup]] = prisma.adoption.findFirstOrThrow.mock
      .calls as unknown as [[{ where: Record<string, unknown> }]];

    expect(lookup.where).toEqual({
      id: 'adoption-1',
      OR: [{ adopterId: 'user-1' }, { ownerId: 'user-1' }],
    });
  });

  it('returns 404 when a participant is denied the specific action', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      action: PolicyAction.RETURN,
      subject: PolicySubject.CUSTODY,
      param: 'id',
    });
    // The pet owner participates in the custody but may not return it.
    prisma.custody.findFirstOrThrow.mockResolvedValue({
      id: 'custody-1',
      holderId: 'holder-1',
      pet: { currentOwnerId: 'owner-1' },
    });

    await expect(
      guard.canActivate(
        contextWith({ sub: 'owner-1', role: Role.SHELTER }, 'custody-1'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not filter admins out of the lookup', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requirement);
    prisma.adoption.findFirstOrThrow.mockResolvedValue({
      id: 'adoption-1',
      adopterId: 'user-1',
      ownerId: 'owner-1',
    });

    await guard.canActivate(contextWith({ sub: 'admin-1', role: Role.ADMIN }));

    const [[lookup]] = prisma.adoption.findFirstOrThrow.mock
      .calls as unknown as [[{ where: Record<string, unknown> }]];

    expect(lookup.where).toEqual({ id: 'adoption-1' });
  });
});

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

const payload = {
  sub: 'user-1',
  email: 'user@example.com',
  role: 'USER',
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const prisma = { user: { findUnique: jest.fn() } };

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(
      { get: () => 'test-secret' } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('accepts an active account and exposes both sub and userId', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      status: UserStatus.ACTIVE,
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      sub: 'user-1',
      userId: 'user-1',
      email: 'user@example.com',
      role: 'USER',
    });
  });

  it('rejects a suspended account with 403 ACCOUNT_SUSPENDED', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      status: UserStatus.SUSPENDED,
    });

    let error: unknown;
    try {
      await strategy.validate(payload);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ForbiddenException);

    const forbidden = error as ForbiddenException;
    expect(forbidden.getStatus()).toBe(403);
    expect(forbidden.getResponse()).toEqual(
      expect.objectContaining({ error: 'ACCOUNT_SUSPENDED' }),
    );
  });

  it('rejects a deleted account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      status: UserStatus.DELETED,
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token for a user that no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockEventsService = {
  logEvent: jest.fn(),
};

describe('UsersService – suspension lifecycle', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('suspend', () => {
    it('marks an active user as SUSPENDED and records the reason', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.SUSPENDED,
        suspendedAt: new Date('2026-01-01T00:00:00.000Z'),
        suspensionReason: 'Trust policy violation',
      });

      const result = await service.suspend(
        'user-1',
        '  Trust policy violation  ',
        'admin-1',
      );

      expect(result.status).toBe(UserStatus.SUSPENDED);

      const [[updateCall]] = mockPrisma.user.update.mock.calls as unknown as [
        [
          {
            where: { id: string };
            data: {
              status: UserStatus;
              suspensionReason: string;
              suspendedAt: Date;
            };
          },
        ],
      ];

      expect(updateCall.where).toEqual({ id: 'user-1' });
      expect(updateCall.data.status).toBe(UserStatus.SUSPENDED);
      expect(updateCall.data.suspensionReason).toBe('Trust policy violation');
      expect(updateCall.data.suspendedAt).toBeInstanceOf(Date);
    });

    it('logs a USER_SUSPENDED event with the acting admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.suspend('user-1', 'Abuse', 'admin-1');

      const [[eventCall]] = mockEventsService.logEvent.mock
        .calls as unknown as [
        [
          {
            entityType: string;
            entityId: string;
            eventType: string;
            actorId: string;
            payload: Record<string, unknown>;
          },
        ],
      ];

      expect(eventCall.entityType).toBe('USER');
      expect(eventCall.entityId).toBe('user-1');
      expect(eventCall.eventType).toBe('USER_SUSPENDED');
      expect(eventCall.actorId).toBe('admin-1');
      expect(eventCall.payload).toEqual({
        userId: 'user-1',
        reason: 'Abuse',
        suspendedAt: expect.any(String) as string,
        suspendedBy: 'admin-1',
      });
    });

    it('throws 404 for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.suspend('missing', 'reason')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('throws 409 when the user is already suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.SUSPENDED,
      });

      await expect(service.suspend('user-1', 'again')).rejects.toThrow(
        ConflictException,
      );
      expect(mockEventsService.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('reinstate', () => {
    it('restores ACTIVE status and clears suspension metadata', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.SUSPENDED,
        suspendedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
        suspendedAt: null,
        suspensionReason: null,
      });

      const result = await service.reinstate('user-1', 'admin-1');

      expect(result.status).toBe(UserStatus.ACTIVE);

      const [[updateCall]] = mockPrisma.user.update.mock.calls as unknown as [
        [
          {
            where: { id: string };
            data: {
              status: UserStatus;
              suspendedAt: null;
              suspensionReason: null;
            };
          },
        ],
      ];

      expect(updateCall.where).toEqual({ id: 'user-1' });
      expect(updateCall.data).toEqual({
        status: UserStatus.ACTIVE,
        suspendedAt: null,
        suspensionReason: null,
      });
    });

    it('logs a USER_REINSTATED event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.SUSPENDED,
        suspendedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.reinstate('user-1', 'admin-1');

      const [[eventCall]] = mockEventsService.logEvent.mock
        .calls as unknown as [
        [
          {
            entityType: string;
            entityId: string;
            eventType: string;
            actorId: string;
          },
        ],
      ];

      expect(eventCall.entityType).toBe('USER');
      expect(eventCall.entityId).toBe('user-1');
      expect(eventCall.eventType).toBe('USER_REINSTATED');
      expect(eventCall.actorId).toBe('admin-1');
    });

    it('throws 409 when the user is not suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
        suspendedAt: null,
      });

      await expect(service.reinstate('user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws 404 for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.reinstate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

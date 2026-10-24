import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionCleanupJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupJob.name);
  private intervalId: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Run once a day (24 hours)
    const twentyFourHours = 24 * 60 * 60 * 1000;
    this.intervalId = setInterval(() => this.handleCron(), twentyFourHours);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async handleCron() {
    this.logger.debug('Running expired sessions cleanup job');
    try {
      const result = await this.prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { not: null } },
          ],
        },
      });
      this.logger.debug(`Deleted ${result.count} expired or revoked sessions`);
    } catch (error) {
      this.logger.error('Failed to cleanup sessions', error);
    }
  }
}

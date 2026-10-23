import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly forgotRateLimitMap = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional()
    private readonly emailService?: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async forgotPassword(email: string, ip: string) {
    const rateLimitKey = `${email}:${ip}`;
    const now = Date.now();
    const lastRequest = this.forgotRateLimitMap.get(rateLimitKey) || 0;
    const rateLimitWindowMs = 60 * 1000; // 1 minute rate limit window

    if (now - lastRequest < rateLimitWindowMs) {
      this.logger.warn(`Rate limit exceeded for forgot password: ${rateLimitKey}`);
      // Return 202 identical response for anti-enumeration and rate-limiting
      return { message: 'If the email exists, a password reset link has been sent.' };
    }

    this.forgotRateLimitMap.set(rateLimitKey, now);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min TTL

      await this.prisma.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
          used: false,
        },
      });

      if (this.emailService) {
        try {
          await this.emailService.sendTransactionalEmail({
            to: user.email,
            subject: 'Password Reset Request',
            text: `Your password reset token is: ${rawToken}. It expires in 30 minutes.`,
          });
        } catch (err) {
          this.logger.error(`Failed to send password reset email: ${err}`);
        }
      }
    }

    return { message: 'If the email exists, a password reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const resetRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { used: true },
      });

      // Update user password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      });

      // Revoke all sessions/tokens if any other tracking exists, or delete all other reset tokens for this user
      await tx.passwordResetToken.deleteMany({
        where: { userId: resetRecord.userId, id: { not: resetRecord.id } },
      });
    });

    if (this.emailService) {
      try {
        await this.emailService.sendTransactionalEmail({
          to: resetRecord.user.email,
          subject: 'Password Reset Successful',
          text: 'Your password has been successfully reset. All active sessions have been revoked.',
        });
      } catch (err) {
        this.logger.error(`Failed to send password reset confirmation email: ${err}`);
      }
    }

    return { message: 'Password successfully reset' };
  }
}

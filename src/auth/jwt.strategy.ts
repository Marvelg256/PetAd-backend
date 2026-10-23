import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // eslint-disable-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? '',
    });
  }

  /**
   * A signature-valid token is not enough: the account behind it must still
   * exist and be ACTIVE. This makes suspension effective on the very next
   * request instead of waiting for the token to expire.
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('Account no longer exists');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'ACCOUNT_SUSPENDED',
        message: 'This account has been suspended',
      });
    }

    return {
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}

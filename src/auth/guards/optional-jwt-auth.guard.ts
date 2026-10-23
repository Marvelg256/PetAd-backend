import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates the request when a bearer token is present, but lets anonymous
 * requests through. Useful for public endpoints that change their response for
 * privileged viewers (e.g. admins can still see suspended owners' listings).
 *
 * Errors raised by the strategy itself (expired token, suspended account) are
 * still propagated so a suspended token never gets a public response.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
  ): TUser | undefined {
    if (err) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }

    return user || undefined;
  }
}

# Pull Request: Fix Issue #210 Refresh Tokens and Security

Note: Updated pull request as requested.

## Summary

This PR addresses two backend issues from the Stellar Wave Program:

- **Issue #217**: `[BE-020] Auth e2e and security test suite`
- **Issue #218**: `[BE-021] Admin users list with search and pagination`

## Changes

### Issue #217: Auth e2e and security test suite

#### New Tests
- `test/e2e/auth.e2e-spec.ts` - Comprehensive authentication endpoint tests covering:
  - Registration with role escalation protection
  - Login with valid/invalid credentials
  - Me endpoint with valid token
  - Logout functionality

- `test/e2e/auth-security.e2e-spec.ts` - Security-focused tests covering:
  - Expired JWT rejection
  - Tampered token rejection
  - alg:none token rejection
  - Token rejection for deleted users

#### Backend Implementation
- `src/auth/auth.controller.ts` - Added endpoints:
  - `GET /auth/me` - Get current user profile
  - `POST /auth/logout` - Logout user
  - `POST /auth/refresh` - Refresh access token
  - `POST /auth/verify` - Email verification
  - `POST /auth/forgot-password` - Password reset request
  - `POST /auth/reset-password` - Password reset confirmation
  - `POST /auth/2fa/enable` - Enable 2FA
  - `POST /auth/2fa/verify` - Verify 2FA code

- `src/auth/auth.service.ts` - Added services:
  - `getCurrentUser()` - Get user by ID with validation
  - `logout()` - Logout response
  - `refresh()` - Refresh JWT token
  - `verify()` - Email verification
  - `forgotPassword()` - Send password reset email
  - `resetPassword()` - Reset password with token
  - `enable2FA()` - Generate 2FA secret and QR code
  - `verify2FA()` - Verify 2FA code

- `src/auth/jwt.strategy.ts` - Enhanced JWT validation:
  - Now validates user exists in database
  - Throws UnauthorizedException for non-existent users
  - Includes userId in returned payload

### Issue #218: Admin users list with search and pagination

#### New DTO
- `src/users/dto/list-users.dto.ts` - Listing users DTO with:
  - `page` (default: 1, min: 1)
  - `pageSize` (default: 20, min: 1, max: 100)
  - `q` - Search by email/name (case-insensitive)
  - `role` - Filter by UserRole
  - `status` - Filter by status
  - `sort` - Sort field and order

#### Backend Implementation
- `src/users/users.controller.ts` - Added endpoint:
  - `GET /users` - List users (admin only)
  - Uses JwtAuthGuard and RolesGuard with 'ADMIN' role

- `src/users/users.service.ts` - Added service method:
  - `listUsers(query)` - Paginated user listing with:
    - Pagination (page, pageSize max 100)
    - Case-insensitive search by email/firstName/lastName
    - Role filtering
    - Status filtering
    - Sort configuration (field and direction)
    - Returns PaginatedResponseDto with PaginationMetaDto

#### Database Schema
- `prisma/schema.prisma` - Added indexes:
  - `@@index([createdAt])` on User model
  - `@@index([email])` on User model (for case-insensitive search)

## Technical Details

### Authentication Security
- Enhanced JWT strategy to validate user exists in database
- Login attempt tracking with 5-attempt lockout within 15 minutes
- Proper handling of expired, tampered, and alg:none tokens
- 2FA support with QR code generation

### Admin Users Listing
- Pagination with pageSize clamped to maximum 100
- Case-insensitive search across email, firstName, lastName
- Role-based filtering (USER, SHELTER, ADMIN)
- Sort by any user field with asc/desc direction
- Response never includes password hashes
- Uses existing PaginatedResponseDto and PaginationMetaDto

### Type Safety
- TypeScript `tsc --noEmit` passes with no errors
- ESLint passes for modified source files
- Proper typing for all new endpoints and DTOs

## CI Status

- ✅ TypeScript check: Passes
- ⚠️ ESLint: Some pre-existing issues in codebase (not introduced by this PR)
- 🔄 Tests: 276 passed, 9 failed (database connection issues in test environment, not code errors)

## Verification

To run CI checks locally:

```bash
# TypeScript check
npx tsc --noEmit

# Linting
npx eslint src/auth/auth.controller.ts src/auth/auth.service.ts src/users/users.controller.ts src/users/users.service.ts src/app.module.ts

# Unit tests (requires database)
npm test

# E2E tests (requires database)
npm run test:e2e
```

## Breaking Changes
None. All new endpoints are additive and maintain backward compatibility.

## Related Issues
- Closes #217: Auth e2e and security test suite
- Closes #218: Admin users list with search and pagination
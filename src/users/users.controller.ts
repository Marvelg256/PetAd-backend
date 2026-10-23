import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';


interface AuthRequest extends Request {
  user: {
    userId?: string;
    sub?: string;
    role: string;
  };
}

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private checkOwnership(req: AuthRequest, id: string) {
    if (
      req.user.userId !== id &&
      req.user.sub !== id &&
      req.user.role !== 'ADMIN'
    ) {
      throw new UnauthorizedException();
    }
  }

  private actorId(req: AuthRequest): string | undefined {
    return req.user.userId ?? req.user.sub;
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Get(':id')
  @ApiOperation({ summary: 'Get user profile' })
  async getProfile(@Param('id') id: string, @Req() req: AuthRequest) {
    this.checkOwnership(req, id);
    return this.usersService.getProfile(id);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Patch(':id')
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthRequest,
  ) {
    this.checkOwnership(req, id);
    return this.usersService.updateProfile(id, dto);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          cb(new BadRequestException('Only JPG/PNG images allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    this.checkOwnership(req, id);

    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }
    const upload = await this.cloudinary.uploadImage(file.buffer, 'users');

    return this.usersService.updateAvatar(id, upload.secure_url);
  }


  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteProfile(@Param('id') id: string, @Req() req: AuthRequest) {
    this.checkOwnership(req, id);
    return this.usersService.deleteProfile(id);
  }

  @Post(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend a user account (Admin only)',
    description:
      'Blocks the account immediately: the suspended user cannot authenticate with an existing token and their pet listings are removed from public search.',
  })
  @ApiResponse({ status: 200, description: 'User suspended' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already suspended' })
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.usersService.suspend(id, dto.reason, this.actorId(req));
  }

  @Post(':id/reinstate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reinstate a suspended user account (Admin only)',
    description:
      'Restores ACTIVE status, clears suspension metadata and lets the user authenticate and list pets again.',
  })
  @ApiResponse({ status: 200, description: 'User reinstated' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is not suspended' })
  async reinstate(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.usersService.reinstate(id, this.actorId(req));
  }
}


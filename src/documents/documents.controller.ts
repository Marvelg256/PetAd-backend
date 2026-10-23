import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckPolicy } from '../common/policies/check-policy.decorator';
import { PolicyAction, PolicySubject } from '../common/policies/policy.types';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @CheckPolicy(PolicyAction.READ, PolicySubject.DOCUMENT)
  @ApiOperation({
    summary: 'Get a document',
    description:
      'Readable by its uploader, the parties of the related adoption, or an admin. ' +
      'Any other caller gets 404 so the document is not disclosed.',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({ status: 200, description: 'Document found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  getDocument(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }
}

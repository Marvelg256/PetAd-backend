import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SuspendUserDto {
  @ApiProperty({
    description:
      'Why the account is being suspended (stored on the user record)',
    example: 'Repeated violation of the platform trust policy',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  @Matches(/\S/, { message: 'reason must not be blank' })
  @MaxLength(500)
  reason!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../domain/models/user';

/**
 * UserResponseDto — HTTP response body for GET /auth/me.
 *
 * Serializes the authenticated User into the safe subset of
 * fields a client may see. The password hash is DELIBERATELY
 * excluded: it never leaves the server, mirroring the redacted
 * toString() on the PasswordHash value object.
 */
export class UserResponseDto {
  @ApiProperty({ description: 'Unique user id (UUID).' })
  readonly id: string;

  @ApiProperty({ description: 'Account email address.' })
  readonly email: string;

  @ApiProperty({ description: 'Public display name.' })
  readonly displayName: string;

  @ApiProperty({
    description: 'Account creation timestamp (ISO 8601).',
    format: 'date-time',
  })
  readonly createdAt: string;

  private constructor(
    id: string,
    email: string,
    displayName: string,
    createdAt: string,
  ) {
    this.id = id;
    this.email = email;
    this.displayName = displayName;
    this.createdAt = createdAt;
  }

  static from(user: User): UserResponseDto {
    return new UserResponseDto(
      user.id,
      user.email.value,
      user.displayName,
      user.createdAt.toISOString(),
    );
  }
}
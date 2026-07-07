import { ApiProperty } from '@nestjs/swagger';
import { AuthToken } from '../../../domain/models/auth-token';

/**
 * AuthTokenResponseDto — HTTP response body for successful
 * authentication (register and login).
 *
 * Serializes the AuthToken domain value object into the JSON
 * shape that clients consume: the raw token string and an
 * ISO 8601 timestamp for the expiration.
 */
export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'Signed JWT to send as a Bearer token on protected routes.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...',
  })
  readonly token: string;

  @ApiProperty({
    description: 'Token expiration timestamp in ISO 8601 format.',
    example: '2026-07-14T00:48:39.063Z',
    format: 'date-time',
  })
  readonly expiresAt: string;

  private constructor(token: string, expiresAt: string) {
    this.token = token;
    this.expiresAt = expiresAt;
  }

  static from(authToken: AuthToken): AuthTokenResponseDto {
    return new AuthTokenResponseDto(
      authToken.value,
      authToken.expiresAt.toISOString(),
    );
  }
}
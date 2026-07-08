import { AuthToken } from '../../models/auth-token';
/**
 * TokenService outbound port.
 *
 * Declares the token operations the application needs: issuing a
 * token for a given user id, and verifying that a raw token string
 * corresponds to a valid user id.
 *
 * Implementations (e.g. JwtTokenService) live in the infrastructure
 * layer and adapt a specific library or protocol to this contract.
 *
 * DIP: the use cases depend on this abstraction. Switching from JWT
 * to PASETO, or from HS256 to RS256, requires zero changes here.
 */
export interface ITokenService {
  /**
   * Issue a token that identifies the given user id.
   * Returns an AuthToken with its expiration timestamp populated.
   */
  issue(userId: string): Promise<AuthToken>;

  /**
   * Verify a raw token string. If it is valid and unexpired,
   * returns the user id it belongs to. If it is invalid or
   * expired, throws.
   */
  verify(rawToken: string): Promise<string>;
}
/**
 * Injection tokens for the outbound ports.
 *
 * TypeScript interfaces are erased at runtime, so Nest's DI container
 * cannot use them as tokens directly. We define one Symbol per port
 * and refer to it in @Inject() decorators and in the module's providers
 * array. This keeps the application layer free of framework decorators
 * while still letting Nest resolve the concrete adapter for each port.
 */
export const USER_REPOSITORY = Symbol('IUserRepository');
export const PASSWORD_HASHER = Symbol('IPasswordHasher');
export const TOKEN_SERVICE = Symbol('ITokenService');
export const CLOCK = Symbol('IClock');
export const ID_GENERATOR = Symbol('IIdGenerator');
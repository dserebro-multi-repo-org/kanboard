/**
 * Minimal contract of `app/Core/User/UserSession.php` needed by the foundation models.
 * The real implementation arrives with the authentication milestone (stub removed in M15).
 */
export interface UserSessionInterface {
  /** Id of the logged in user, 0 when nobody is logged in. */
  getId(): number;
}

/** Compiling stub: nobody is logged in. */
export class UserSessionStub implements UserSessionInterface {
  getId(): number {
    return 0;
  }
}

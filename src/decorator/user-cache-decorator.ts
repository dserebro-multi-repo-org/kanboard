import type { CacheInterface } from '../core/cache/cache-interface.js';
import type { Row } from '../foundation/model.js';
import type { UserModelLike } from '../foundation/formatter-collaborators.js';

/** Caches `UserModel::getByUsername()` (port of `Kanboard\Decorator\UserCacheDecorator`). */
export class UserCacheDecorator {
  protected cachePrefix = 'user_model:';

  constructor(
    protected readonly cache: CacheInterface,
    private readonly userModel: Pick<UserModelLike, 'getByUsername'>,
  ) {}

  /** Get a specific user by the username. */
  async getByUsername(username: string): Promise<Row | null | false> {
    const key = `${this.cachePrefix}${username}`;
    let user = this.cache.get<Row | false>(key);

    if (user === null) {
      user = await this.userModel.getByUsername(username);
      this.cache.set(key, user);
    }

    return user;
  }
}

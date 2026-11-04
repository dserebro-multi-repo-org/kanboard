import { BatchBHelper, UserMetadataKeys } from './batch-b-support.js';

/** Port of `app/Helper/CommentHelper.php`. */
export class CommentHelper extends BatchBHelper {
  async toggleSorting(): Promise<void> {
    const metadata = this.collab('userMetadataCacheDecorator');
    const oldDirection = await metadata.get(UserMetadataKeys.KEY_COMMENT_SORTING_DIRECTION, 'ASC');
    const newDirection = oldDirection === 'ASC' ? 'DESC' : 'ASC';

    await metadata.set(UserMetadataKeys.KEY_COMMENT_SORTING_DIRECTION, newDirection);
  }
}

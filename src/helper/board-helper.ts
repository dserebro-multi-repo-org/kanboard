import { BatchBHelper, UserMetadataKeys } from './batch-b-support.js';

/** Port of `app/Helper/BoardHelper.php`. */
export class BoardHelper extends BatchBHelper {
  /** Return true if tasks are collapsed. */
  async isCollapsed(projectId: unknown): Promise<boolean> {
    const value = await this.collab('userMetadataCacheDecorator').get(`${UserMetadataKeys.KEY_BOARD_COLLAPSED}${String(projectId)}`, 0);
    return Number(value) === 1 && String(value).trim() !== '';
  }
}

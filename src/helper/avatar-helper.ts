import { empty, BatchBHelper } from './batch-b-support.js';

/** Port of `app/Helper/AvatarHelper.php`. */
export class AvatarHelper extends BatchBHelper {
  /** Render user avatar. */
  render(userId: unknown, username: unknown, name: unknown, email: unknown, avatarPath: unknown, css = 'avatar-left', size = 48): string {
    const avatarManager = this.collab('avatarManager');
    const html =
      empty(userId) && empty(username) ? avatarManager.renderDefault(size) : avatarManager.render(userId, username, name, email, avatarPath, size);

    return `<div class="avatar avatar-${size} ${css}">${html}</div>`;
  }

  /** Render small user avatar. */
  small(userId: unknown, username: unknown, name: unknown, email: unknown, avatarPath: unknown, css = ''): string {
    return this.render(userId, username, name, email, avatarPath, css, 20);
  }

  /** Get a small avatar for the current user. */
  currentUserSmall(css = ''): string {
    const user = this.userSession.getAll();
    return this.small(user.id, user.username, user.name, user.email, user.avatar_path, css);
  }
}

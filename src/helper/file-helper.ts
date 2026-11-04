import { HelperBase } from './helper-base.js';
import { getFileExtension } from './php.js';

const ICONS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['fa-file-image-o', ['jpeg', 'jpg', 'png', 'gif', 'svg', 'webp']],
  ['fa-file-excel-o', ['xls', 'xlsx', 'xlsm']],
  ['fa-file-word-o', ['doc', 'docx']],
  ['fa-file-powerpoint-o', ['ppt', 'pptx']],
  ['fa-file-archive-o', ['zip', 'rar', 'tar', 'bz2', 'xz', 'gz']],
  ['fa-file-audio-o', ['mp3', 'amr', 'flac', 'm4a', 'ogg', 'opus', 'wav', 'wma', 'midi', 'mid']],
  ['fa-file-video-o', ['avi', 'mov', 'mp4', 'mkv', 'webm']],
  ['fa-file-code-o', ['php', 'html', 'css', 'js']],
  ['fa-file-pdf-o', ['pdf']],
];

const BROWSER_VIEW_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  ogg: 'audio/mpeg',
  flac: 'audio/mpeg',
  wav: 'audio/mpeg',
  avi: 'video/x-msvideo',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  mp4: 'video/mp4',
  svg: 'image/svg+xml',
};

/** Port of `app/Helper/FileHelper.php`. */
export class FileHelper extends HelperBase {
  /** Font-Awesome icon name of a file. */
  icon(filename: string): string {
    const extension = getFileExtension(filename);
    return ICONS.find(([, extensions]) => extensions.includes(extension))?.[0] ?? 'fa-file-o';
  }

  /** Image mime type based on the file extension (defaults to JPEG). */
  getImageMimeType(filename: string): string {
    switch (getFileExtension(filename)) {
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  /** Preview type: `markdown`, `text` or null. */
  getPreviewType(filename: string): string | null {
    switch (getFileExtension(filename)) {
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'txt':
        return 'text';
      default:
        return null;
    }
  }

  /** Browser view mime type based on the file extension, null when the browser cannot display it. */
  getBrowserViewType(filename: string): string | null {
    return BROWSER_VIEW_TYPES[getFileExtension(filename)] ?? null;
  }
}

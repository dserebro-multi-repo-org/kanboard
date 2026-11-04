import { HelperBase } from './helper-base.js';
import { phpEmpty } from './php.js';

/** Port of `app/Helper/MailHelper.php`. */
export class MailHelper extends HelperBase {
  /** Filter mail subject (case insensitive `RE: `, `FW: `, `Fwd: ` removal). */
  filterSubject(subject: string): string {
    return subject.replace(/RE: /gi, '').replace(/FW: /gi, '').replace(/Fwd: /gi, '');
  }

  /** Mail sender address: the setting when `MAIL_CONFIGURATION` is on and not empty, else `MAIL_FROM`. */
  async getMailSenderAddress(): Promise<string> {
    const config = this.service('config');

    if (config.MAIL_CONFIGURATION) {
      const email = await this.service('configModel').get('mail_sender_address');
      if (!phpEmpty(email)) return email;
    }

    return config.MAIL_FROM;
  }

  /** Mail transport: the setting when `MAIL_CONFIGURATION` is on and not empty, else `MAIL_TRANSPORT`. */
  async getMailTransport(): Promise<string> {
    const config = this.service('config');

    if (config.MAIL_CONFIGURATION) {
      const transport = await this.service('configModel').get('mail_transport');
      if (!phpEmpty(transport)) return transport;
    }

    return config.MAIL_TRANSPORT;
  }
}

import { afterEach, describe, expect, it } from 'vitest';
import { Translator } from '../../../src/core/translator/translator.js';
import { t } from '../../../src/validator/translate.js';
import { t as foundationT } from '../../../src/foundation/translator.js';

describe('translator wiring', () => {
  afterEach(() => Translator.unload());

  it('validator t() uses the loaded locale', () => {
    Translator.locales['Passwords don\'t match'] = 'Les mots de passe ne correspondent pas';
    expect(t('Passwords don\'t match')).toBe('Les mots de passe ne correspondent pas');
  });

  it('foundation t() uses the loaded locale', () => {
    Translator.locales['Hello %s'] = 'Bonjour %s';
    expect(foundationT('Hello %s', 'a')).toBe('Bonjour a');
  });
});

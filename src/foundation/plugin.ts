import type { Container } from '../core/container/container.js';
import { Hook } from '../core/plugin/hook.js';

/**
 * Contract of a plugin (`app/Core/Plugin/Base.php`). Plugins are loaded from `PLUGINS_DIR`, receive the container
 * and register services, helpers, listeners and hooks in {@link initialize}.
 */
export interface PluginInterface {
  /** Called once when the plugin is loaded. */
  initialize(): void | Promise<void>;
  getPluginName(): string;
  getPluginDescription(): string;
  getPluginAuthor(): string;
  getPluginVersion(): string;
  getPluginHomepage(): string;
  /** Minimum compatible Kanboard version (PHP `getCompatibleVersion`). */
  getCompatibleVersion(): string;
  /** Classes to register in the container, grouped by namespace (`getClasses`). */
  getClasses(): Record<string, readonly string[]>;
  /** Helpers to register, `name -> class` (`getHelpers`). */
  getHelpers(): Record<string, new (container: Container) => unknown>;
}

/** Constructor signature of a plugin class. */
export type PluginConstructor = new (container: Container) => PluginInterface;

/**
 * Hook registry exposed to plugins (`$this->hook->on(...)`): `on` registers a listener on a named hook,
 * `emit` calls all of them. See {@link Hook} for the merge / first / reference helpers.
 */
export class HookRegistry extends Hook {}

/** Well-known hook names used by templates and models (a subset, plugins may define their own). */
export const HOOKS = {
  TEMPLATE_LAYOUT_CSS: 'template:layout:css',
  TEMPLATE_LAYOUT_JS: 'template:layout:js',
  TEMPLATE_LAYOUT_HEAD: 'template:layout:head',
  MODEL_TASK_CREATION_PREPARE: 'model:task:creation:prepare',
  MODEL_TASK_MODIFICATION_PREPARE: 'model:task:modification:prepare',
  CONTROLLER_BEFORE: 'controller:before',
} as const;

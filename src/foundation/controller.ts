import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import type { Request } from '../core/http/request.js';
import type { Response } from '../core/http/response.js';
import type { RouteContext, RouteHandler } from '../core/http/router.js';
import { AccessForbiddenException, PageNotFoundException } from '../core/controller/exceptions.js';

/** Contract of a controller: executes one of its public actions by name. */
export interface ControllerInterface {
  /** Run `action`; rejects with `PageNotFoundException` if the action does not exist. */
  handle(action: string): Promise<unknown>;
}

/** Constructor of a controller class. */
export type ControllerConstructor<C extends ControllerInterface = ControllerInterface> = new (
  container: Container,
  request: Request,
  response: Response,
) => C;

/** Methods that can never be dispatched as actions. */
const RESERVED = new Set(['constructor', 'handle', 'resolveAction', 'getContainer']);

/**
 * Base class of all controllers, replacing `app/Controller/BaseController.php`. A controller is created
 * per request with the container, the request and the response, and exposes public methods as actions
 * (`TaskViewController.show`). The concrete subclasses are ported by the feature milestones.
 */
export abstract class BaseController extends Base implements ControllerInterface {
  constructor(
    container: Container,
    protected readonly request: Request,
    protected readonly response: Response,
  ) {
    super(container);
  }

  /** Dispatch an action by name. Only methods declared by subclasses (not by this base class) are callable. */
  async handle(action: string): Promise<unknown> {
    const method = this.resolveAction(action);
    if (method === undefined) {
      throw new PageNotFoundException(`Action "${action}" not found.`);
    }
    return method.call(this);
  }

  /** Throw `AccessForbiddenException` unless the condition holds. */
  protected assertAllowed(allowed: boolean, message = ''): void {
    if (!allowed) {
      throw new AccessForbiddenException(message);
    }
  }

  /** Throw `PageNotFoundException` when the value is empty (null, undefined, false, 0, ''). */
  protected assertFound<T>(value: T | null | undefined | false, message = ''): T {
    if (value === null || value === undefined || value === false || (value as unknown) === 0 || (value as unknown) === '') {
      throw new PageNotFoundException(message);
    }
    return value as T;
  }

  private resolveAction(action: string): ((this: BaseController) => unknown) | undefined {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(action) || RESERVED.has(action) || action.startsWith('_')) {
      return undefined;
    }

    // Walk the prototype chain up to (not including) BaseController.
    let proto: object | null = Object.getPrototypeOf(this) as object | null;
    while (proto !== null && proto !== BaseController.prototype) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, action);
      if (descriptor !== undefined) {
        return typeof descriptor.value === 'function' ? (descriptor.value as (this: BaseController) => unknown) : undefined;
      }
      proto = Object.getPrototypeOf(proto) as object | null;
    }
    return undefined;
  }
}

/**
 * Adapt a controller action to a router {@link RouteHandler}: a controller is built per request
 * and the action executed.
 */
export function controllerHandler(container: Container, controllerClass: ControllerConstructor, action: string): RouteHandler {
  return ({ request, response }: RouteContext) => new controllerClass(container, request, response).handle(action);
}

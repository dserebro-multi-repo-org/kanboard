import { BaseValidator } from './base-validator.js';
import { t } from './translate.js';
import { Validator, Validators } from './simple-validator.js';
import type { ValidationResult, Values } from './simple-validator.js';

import type {
  ColumnListModelLike,
  IdList,
  ProjectPermissionModelLike,
  ProjectUserRoleModelLike,
  ValidatorUserSession,
} from '../foundation/validator-collaborators.js';

export interface ActionValidatorDeps {
  columnModel: ColumnListModelLike;
  swimlaneModel: ColumnListModelLike;
  categoryModel: ColumnListModelLike;
  projectUserRoleModel: ProjectUserRoleModelLike;
  projectPermissionModel: ProjectPermissionModelLike;
  userSession: ValidatorUserSession;
}

export class ActionValidator extends BaseValidator {
  constructor(private readonly deps: ActionValidatorDeps) {
    super();
  }

  /** Validate action creation. */
  async validateCreation(values: Values): Promise<ValidationResult> {
    const v = new Validator(values, [
      new Validators.Required('project_id', t('The project id is required')),
      new Validators.Integer('project_id', t('This value must be an integer')),
      new Validators.Required('event_name', t('This value is required')),
      new Validators.Required('action_name', t('This value is required')),
      new Validators.Required('params', t('This value is required')),
    ]);

    return [await v.execute(), v.getErrors()];
  }

  /**
   * Validate action parameters: scalar values only, and project resources (columns, swimlanes,
   * categories, users, destination projects) must belong to the project / be accessible.
   */
  async validateParameters(projectId: number, userId: number, params: Values): Promise<boolean> {
    for (const [name, value] of Object.entries(params)) {
      if (!isScalar(value) || !(await this.isValidParameter(projectId, userId, name, value))) {
        return false;
      }
    }
    return true;
  }

  private async isValidParameter(projectId: number, userId: number, name: string, value: string | number | boolean): Promise<boolean> {
    if (name.includes('project_id')) {
      return this.isValidId(value) && (await this.isProjectAccessible(Number(value), userId));
    }

    const allowedValues = await this.getProjectValues(projectId, name);

    if (allowedValues === null) {
      return true;
    }

    return this.isValidId(value) && Object.prototype.hasOwnProperty.call(allowedValues, String(value));
  }

  private isValidId(value: unknown): boolean {
    return (typeof value === 'number' && Number.isInteger(value)) || (typeof value === 'string' && /^\d+$/.test(value));
  }

  private async getProjectValues(projectId: number, name: string): Promise<IdList | null> {
    if (name.includes('column_id')) {
      return this.deps.columnModel.getList(projectId);
    } else if (name.includes('swimlane_id')) {
      return this.deps.swimlaneModel.getList(projectId);
    } else if (name.includes('category_id')) {
      return this.deps.categoryModel.getList(projectId);
    } else if (name.includes('user_id') || name.includes('owner_id')) {
      return this.deps.projectUserRoleModel.getAssignableUsersList(projectId);
    }
    return null;
  }

  private async isProjectAccessible(projectId: number, userId: number): Promise<boolean> {
    // There is no user session when the API is used with the application credentials
    if (!this.deps.userSession.isLogged()) {
      return true;
    }
    return this.deps.projectPermissionModel.isUserAllowed(projectId, userId);
  }
}

/** PHP `is_scalar`. */
function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

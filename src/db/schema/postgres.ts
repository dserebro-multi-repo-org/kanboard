import { getToken } from '../../core/security/token.js';
import type { Database } from '../database.js';
import type { MigrationFunction, SchemaDefinition } from './types.js';

/**
 * PostgreSQL schema, a port of `app/Schema/Postgres.php` (versions 1 to 117, same statements in the same order).
 * Versions 31 to 33 do not exist in the PHP code base and are therefore no-ops.
 */
export const POSTGRES_SCHEMA_VERSION = 117;

/** bcrypt hash of the default `admin` password (`password_hash('admin', PASSWORD_BCRYPT)`). */
const DEFAULT_ADMIN_PASSWORD_HASH = '$2y$10$GzDCeQl/GdH.pCZfz4fWdO3qmayutRCmxEIY9U9t1k9q9F89VNDCm';

/** `Kanboard\Core\Security\Role` constants used by the migrations. */
const Role = {
  APP_ADMIN: 'app-admin',
  APP_MANAGER: 'app-manager',
  APP_USER: 'app-user',
  PROJECT_MANAGER: 'project-manager',
  PROJECT_MEMBER: 'project-member',
  PROJECT_VIEWER: 'project-viewer',
} as const;

const generateToken = getToken;

/** PHP loose comparison `$value == 1` for values coming from a boolean/integer column. */
function equalsOne(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't' || value === 'true';
}

/** PHP truthiness of a boolean/integer column value. */
function isTruthy(value: unknown): boolean {
  return value !== null && value !== undefined && value !== false && value !== 0 && value !== '' && value !== '0' && value !== 'f' && value !== 'false';
}

/** Port of `Schema\migrate_default_swimlane()` (`Schema\get_last_insert_id()` is `LASTVAL()` on PostgreSQL, here `RETURNING id`). */
async function migrateDefaultSwimlane(db: Database): Promise<void> {
  const { rows: projects } = await db.exec('SELECT * FROM projects');

  for (const project of projects) {
    let defaultSwimlane = project.default_swimlane ? String(project.default_swimlane) : 'Default swimlane';

    const existing = await db.exec('SELECT 1 FROM swimlanes WHERE name=? AND project_id=?', [defaultSwimlane, project.id as number]);

    if (existing.rows.length > 0) {
      defaultSwimlane = `${defaultSwimlane} (Default swimlane)`;
    }

    // Create new default swimlane
    const show = isTruthy(project.show_default_swimlane) ? 1 : 0;
    const inserted = await db.exec('INSERT INTO swimlanes (project_id, name, is_active, position) VALUES (?, ?, ?, ?) RETURNING id', [
      project.id as number,
      defaultSwimlane,
      show,
      equalsOne(project.show_default_swimlane) ? 1 : 0,
    ]);
    const swimlaneId = Number(inserted.rows[0]?.id ?? inserted.insertId);

    // Reorder swimlanes if the default one was active
    if (isTruthy(project.show_default_swimlane)) {
      await db.exec("UPDATE swimlanes SET position=position+1 WHERE project_id=? AND is_active='1' AND id!=?", [project.id as number, swimlaneId]);
    }

    // Move all tasks to new swimlane
    await db.exec("UPDATE tasks SET swimlane_id=? WHERE swimlane_id='0' AND project_id=?", [swimlaneId, project.id as number]);

    // Migrate automatic actions
    const { rows: params } = await db.exec(
      "SELECT action_has_params.id FROM action_has_params LEFT JOIN actions ON actions.id=action_has_params.action_id WHERE project_id=? AND name='swimlane_id' AND value='0'",
      [project.id as number],
    );

    for (const param of params) {
      await db.exec('UPDATE action_has_params SET value=? WHERE id=?', [swimlaneId, param.id as number]);
    }
  }
}

const migrations: Record<number, MigrationFunction> = {
  // version_1
  1: async (db) => {
    await db.exec(`
        CREATE TABLE config (
            language CHAR(5) DEFAULT 'en_US',
            webhooks_token VARCHAR(255) DEFAULT '',
            timezone VARCHAR(50) DEFAULT 'UTC',
            api_token VARCHAR(255) DEFAULT ''
        );

        CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50),
            password VARCHAR(255),
            is_admin BOOLEAN DEFAULT '0',
            default_project_id INTEGER DEFAULT 0,
            is_ldap_user BOOLEAN DEFAULT '0',
            name VARCHAR(255),
            email VARCHAR(255),
            google_id VARCHAR(255),
            github_id VARCHAR(30)
        );

        CREATE TABLE remember_me (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            ip VARCHAR(45),
            user_agent VARCHAR(255),
            token VARCHAR(255),
            sequence VARCHAR(255),
            expiration INTEGER,
            date_creation INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE last_logins (
            id SERIAL PRIMARY KEY,
            auth_type VARCHAR(25),
            user_id INTEGER,
            ip VARCHAR(45),
            user_agent VARCHAR(255),
            date_creation INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE projects (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE,
            is_active BOOLEAN DEFAULT '1',
            token VARCHAR(255),
            last_modified INTEGER DEFAULT 0
        );

        CREATE TABLE project_has_users (
            id SERIAL PRIMARY KEY,
            project_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(project_id, user_id)
        );

        CREATE TABLE project_has_categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            project_id INTEGER,
            UNIQUE (project_id, name),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE columns (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            position INTEGER,
            project_id INTEGER,
            task_limit INTEGER DEFAULT 0,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (title, project_id)
        );

        CREATE TABLE tasks (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            description TEXT,
            date_creation INTEGER,
            color_id VARCHAR(255),
            project_id INTEGER,
            column_id INTEGER,
            owner_id INTEGER DEFAULT 0,
            position INTEGER,
            is_active BOOLEAN DEFAULT '1',
            date_completed INTEGER,
            score INTEGER,
            date_due INTEGER,
            category_id INTEGER DEFAULT 0,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE
        );

        CREATE TABLE task_has_subtasks (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255),
            status SMALLINT DEFAULT 0,
            time_estimated INTEGER DEFAULT 0,
            time_spent INTEGER DEFAULT 0,
            task_id INTEGER NOT NULL,
            user_id INTEGER,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE task_has_files (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            path VARCHAR(255),
            is_image BOOLEAN DEFAULT '0',
            task_id INTEGER,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE comments (
            id SERIAL PRIMARY KEY,
            task_id INTEGER,
            user_id INTEGER,
            date INTEGER,
            comment TEXT,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE actions (
            id SERIAL PRIMARY KEY,
            project_id INTEGER,
            event_name VARCHAR(50),
            action_name VARCHAR(50),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE action_has_params (
            id SERIAL PRIMARY KEY,
            action_id INTEGER,
            name VARCHAR(50),
            value VARCHAR(50),
            FOREIGN KEY(action_id) REFERENCES actions(id) ON DELETE CASCADE
        );
    `);

    await db.exec(`
        INSERT INTO users
        (username, password, is_admin)
        VALUES ('admin', '${DEFAULT_ADMIN_PASSWORD_HASH}', '1')
    `);

    await db.exec(`
        INSERT INTO config
        (webhooks_token, api_token)
        VALUES ('${generateToken()}', '${generateToken()}')
    `);
  },

  // version_2
  2: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN creator_id INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_modification INTEGER DEFAULT 0`);
  },

  // version_3
  3: async (db) => {
    await db.exec(`ALTER TABLE config ADD COLUMN webhooks_url_task_modification VARCHAR(255)`);
    await db.exec(`ALTER TABLE config ADD COLUMN webhooks_url_task_creation VARCHAR(255)`);
  },

  // version_4
  4: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN DEFAULT '0'`);
    await db.exec(`
        CREATE TABLE user_has_notifications (
            user_id INTEGER,
            project_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, user_id)
        );
    `);
  },

  // version_5
  5: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN is_public BOOLEAN DEFAULT '0'`);
  },

  // version_6
  6: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_events (
            id SERIAL PRIMARY KEY,
            date_creation INTEGER NOT NULL,
            event_name VARCHAR(50) NOT NULL,
            creator_id INTEGER,
            project_id INTEGER,
            task_id INTEGER,
            data TEXT,
            FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
    `);
    await db.exec(`
        CREATE TABLE subtask_has_events (
            id SERIAL PRIMARY KEY,
            date_creation INTEGER NOT NULL,
            event_name VARCHAR(50) NOT NULL,
            creator_id INTEGER,
            project_id INTEGER,
            subtask_id INTEGER,
            task_id INTEGER,
            data TEXT,
            FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(subtask_id) REFERENCES task_has_subtasks(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
    `);
    await db.exec(`
        CREATE TABLE comment_has_events (
            id SERIAL PRIMARY KEY,
            date_creation INTEGER NOT NULL,
            event_name VARCHAR(50) NOT NULL,
            creator_id INTEGER,
            project_id INTEGER,
            comment_id INTEGER,
            task_id INTEGER,
            data TEXT,
            FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
    `);
  },

  // version_7
  7: async (db) => {
    await db.exec(`ALTER TABLE config ADD COLUMN default_columns VARCHAR(255) DEFAULT ''`);
  },

  // version_8
  8: async (db) => {
    await db.exec(`CREATE UNIQUE INDEX users_username_idx ON users(username)`);
  },

  // version_9
  9: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN reference VARCHAR(50) DEFAULT ''`);
    await db.exec(`ALTER TABLE comments ADD COLUMN reference VARCHAR(50) DEFAULT ''`);
    await db.exec(`CREATE INDEX tasks_reference_idx ON tasks(reference)`);
    await db.exec(`CREATE INDEX comments_reference_idx ON comments(reference)`);
  },

  // version_10
  10: async (db) => {
    await db.exec(`
        CREATE TABLE settings (
            option VARCHAR(100) PRIMARY KEY,
            value VARCHAR(255) DEFAULT ''
        )
    `);

    // Migrate old config parameters
    const { rows } = await db.exec('SELECT * FROM config');
    const parameters = rows[0] ?? {};

    const insert = 'INSERT INTO settings VALUES (?, ?)';
    await db.exec(insert, ['board_highlight_period', 48 * 60 * 60]);
    await db.exec(insert, ['board_public_refresh_interval', 60]);
    await db.exec(insert, ['board_private_refresh_interval', 10]);
    await db.exec(insert, ['board_columns', parameters.default_columns ?? null]);
    await db.exec(insert, ['webhook_url_task_creation', parameters.webhooks_url_task_creation ?? null]);
    await db.exec(insert, ['webhook_url_task_modification', parameters.webhooks_url_task_modification ?? null]);
    await db.exec(insert, ['webhook_token', parameters.webhooks_token ?? null]);
    await db.exec(insert, ['api_token', parameters.api_token ?? null]);
    await db.exec(insert, ['application_language', parameters.language ?? null]);
    await db.exec(insert, ['application_timezone', parameters.timezone ?? null]);
    await db.exec(insert, ['application_url', '']);

    await db.exec(`DROP TABLE config`);
  },

  // version_11
  11: async (db) => {
    await db.exec('INSERT INTO settings VALUES (?, ?)', ['application_date_format', 'm/d/Y']);
  },

  // version_12
  12: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN is_private BOOLEAN DEFAULT '0'`);
  },

  // version_13
  13: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_started INTEGER`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN time_spent FLOAT DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN time_estimated FLOAT DEFAULT 0`);
    await db.exec(`ALTER TABLE task_has_subtasks ALTER COLUMN time_estimated TYPE FLOAT`);
    await db.exec(`ALTER TABLE task_has_subtasks ALTER COLUMN time_spent TYPE FLOAT`);
  },

  // version_14
  14: async (db) => {
    await db.exec(`
        CREATE TABLE project_activities (
            id SERIAL PRIMARY KEY,
            date_creation INTEGER NOT NULL,
            event_name VARCHAR(50) NOT NULL,
            creator_id INTEGER,
            project_id INTEGER,
            task_id INTEGER,
            data TEXT,
            FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`DROP TABLE task_has_events`);
    await db.exec(`DROP TABLE comment_has_events`);
    await db.exec(`DROP TABLE subtask_has_events`);
  },

  // version_15
  15: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN is_everybody_allowed BOOLEAN DEFAULT '0'`);
  },

  // version_16
  16: async (db) => {
    await db.exec(`
        CREATE TABLE project_daily_summaries (
            id SERIAL PRIMARY KEY,
            day CHAR(10) NOT NULL,
            project_id INTEGER NOT NULL,
            column_id INTEGER NOT NULL,
            total INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`CREATE UNIQUE INDEX project_daily_column_stats_idx ON project_daily_summaries(day, project_id, column_id)`);
  },

  // version_17
  17: async (db) => {
    await db.exec(`ALTER TABLE tasks ALTER COLUMN title SET NOT NULL`);
  },

  // version_18
  18: async (db) => {
    await db.exec(`ALTER TABLE project_has_users ADD COLUMN is_owner BOOLEAN DEFAULT '0'`);
  },

  // version_19
  19: async (db) => {
    await db.exec(`
        CREATE TABLE swimlanes (
            id SERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            position INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT '1',
            project_id INTEGER,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (name, project_id)
        )
    `);
    await db.exec(`ALTER TABLE tasks ADD COLUMN swimlane_id INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE projects ADD COLUMN default_swimlane VARCHAR(200) DEFAULT 'Default swimlane'`);
    await db.exec(`ALTER TABLE projects ADD COLUMN show_default_swimlane BOOLEAN DEFAULT '1'`);
  },

  // version_20
  20: async (db) => {
    await db.exec('INSERT INTO settings VALUES (?, ?)', ['project_categories', '']);
  },

  // version_21
  21: async (db) => {
    // Avoid some full table scans
    await db.exec(`CREATE INDEX users_admin_idx ON users(is_admin)`);
    await db.exec(`CREATE INDEX columns_project_idx ON columns(project_id)`);
    await db.exec(`CREATE INDEX tasks_project_idx ON tasks(project_id)`);
    await db.exec(`CREATE INDEX swimlanes_project_idx ON swimlanes(project_id)`);
    await db.exec(`CREATE INDEX categories_project_idx ON project_has_categories(project_id)`);
    await db.exec(`CREATE INDEX subtasks_task_idx ON task_has_subtasks(task_id)`);
    await db.exec(`CREATE INDEX files_task_idx ON task_has_files(task_id)`);
    await db.exec(`CREATE INDEX comments_task_idx ON comments(task_id)`);

    // Set the ownership for all private projects
    const { rows: projects } = await db.exec("SELECT id FROM projects WHERE is_private='1'");

    for (const project of projects) {
      await db.exec("UPDATE project_has_users SET is_owner='1' WHERE project_id=?", [project.id as number]);
    }
  },

  // version_22
  22: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN timezone VARCHAR(50)`);
    await db.exec(`ALTER TABLE users ADD COLUMN language CHAR(5)`);
  },

  // version_23
  23: async (db) => {
    await db.exec(`ALTER TABLE columns ADD COLUMN description TEXT`);
  },

  // version_24
  24: async (db) => {
    await db.exec('INSERT INTO settings VALUES (?, ?)', ['subtask_restriction', '0']);
    await db.exec('INSERT INTO settings VALUES (?, ?)', ['subtask_time_tracking', '0']);

    await db.exec(`
        CREATE TABLE subtask_time_tracking (
            id SERIAL PRIMARY KEY,
            "user_id" INTEGER NOT NULL,
            "subtask_id" INTEGER NOT NULL,
            "start" INTEGER DEFAULT 0,
            "end" INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(subtask_id) REFERENCES task_has_subtasks(id) ON DELETE CASCADE
        )
    `);
  },

  // version_25
  25: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN disable_login_form BOOLEAN DEFAULT '0'`);
  },

  // version_26
  26: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_moved INT DEFAULT 0`);
    await db.exec(`UPDATE tasks
                SET date_moved = (
                    SELECT md
                    FROM (
                        SELECT task_id, max(date_creation) md
                        FROM project_activities
                        WHERE event_name IN ('task.create', 'task.move.column')
                        GROUP BY task_id
                    ) src
                    WHERE id = src.task_id
                )
                WHERE (date_moved IS NULL OR date_moved = 0) AND id IN (
                    SELECT task_id
                    FROM (
                        SELECT task_id, max(date_creation) md
                        FROM project_activities
                        WHERE event_name IN ('task.create', 'task.move.column')
                        GROUP BY task_id
                    ) src
                )`);
    await db.exec(`UPDATE tasks SET date_moved = date_creation WHERE date_moved IS NULL OR date_moved = 0`);
  },

  // version_27
  27: async (db) => {
    await db.exec(`CREATE TABLE links (
        "id" SERIAL PRIMARY KEY,
        "label" VARCHAR(255) NOT NULL,
        "opposite_id" INTEGER DEFAULT 0,
        UNIQUE("label")
    )`);

    await db.exec(`CREATE TABLE task_has_links (
        id SERIAL PRIMARY KEY,
        link_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        opposite_task_id INTEGER NOT NULL,
        FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE CASCADE,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(opposite_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`);

    await db.exec(`CREATE INDEX task_has_links_task_index ON task_has_links(task_id)`);
    await db.exec(`CREATE UNIQUE INDEX task_has_links_unique ON task_has_links(link_id, task_id, opposite_task_id)`);

    const insert = 'INSERT INTO links (label, opposite_id) VALUES (?, ?)';
    await db.exec(insert, ['relates to', 0]);
    await db.exec(insert, ['blocks', 3]);
    await db.exec(insert, ['is blocked by', 2]);
    await db.exec(insert, ['duplicates', 5]);
    await db.exec(insert, ['is duplicated by', 4]);
    await db.exec(insert, ['is a child of', 7]);
    await db.exec(insert, ['is a parent of', 6]);
    await db.exec(insert, ['targets milestone', 9]);
    await db.exec(insert, ['is a milestone of', 8]);
    await db.exec(insert, ['fixes', 11]);
    await db.exec(insert, ['is fixed by', 10]);
  },

  // version_28
  28: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN description TEXT`);
  },

  // version_29
  29: async (db) => {
    await db.exec(`ALTER TABLE task_has_files RENAME TO files`);
    await db.exec(`ALTER TABLE task_has_subtasks RENAME TO subtasks`);
  },

  // version_30
  30: async (db) => {
    await db.exec(`ALTER TABLE subtasks ADD COLUMN position INTEGER DEFAULT 1`);

    let taskId = 0;
    let position = 1;

    const { rows } = await db.exec('SELECT * FROM subtasks ORDER BY task_id, id ASC');

    for (const subtask of rows) {
      // eslint-disable-next-line eqeqeq
      if (taskId != subtask.task_id) {
        position = 1;
        taskId = subtask.task_id as number;
      }

      await db.exec('UPDATE subtasks SET position=? WHERE id=?', [position, subtask.id as number]);
      position++;
    }
  },

  // version_34
  34: async (db) => {
    await db.exec(`ALTER TABLE subtask_time_tracking ADD COLUMN time_spent REAL DEFAULT 0`);
  },

  // version_35
  35: async (db) => {
    await db.exec('INSERT INTO settings VALUES (?, ?)', ['application_stylesheet', '']);
  },

  // version_36
  36: async (db) => {
    await db.exec('INSERT INTO settings VALUES (?, ?)', ['subtask_forecast', '0']);
  },

  // version_37
  37: async (db) => {
    await db.exec(`CREATE TABLE transitions (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "project_id" INTEGER NOT NULL,
        "task_id" INTEGER NOT NULL,
        "src_column_id" INTEGER NOT NULL,
        "dst_column_id" INTEGER NOT NULL,
        "date" INTEGER NOT NULL,
        "time_spent" INTEGER DEFAULT 0,
        FOREIGN KEY(src_column_id) REFERENCES columns(id) ON DELETE CASCADE,
        FOREIGN KEY(dst_column_id) REFERENCES columns(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`);
    await db.exec(`CREATE INDEX transitions_task_index ON transitions(task_id)`);
    await db.exec(`CREATE INDEX transitions_project_index ON transitions(project_id)`);
    await db.exec(`CREATE INDEX transitions_user_index ON transitions(user_id)`);
  },

  // version_38
  38: async (db) => {
    await db.exec(`CREATE TABLE currencies ("currency" CHAR(3) NOT NULL UNIQUE, "rate" REAL DEFAULT 0)`);

    await db.exec('INSERT INTO settings VALUES (?, ?)', ['application_currency', 'USD']);
  },

  // version_39
  39: async (db) => {
    const insert = 'INSERT INTO settings VALUES (?, ?)';
    await db.exec(insert, ['integration_slack_webhook', '0']);
    await db.exec(insert, ['integration_slack_webhook_url', '']);
  },

  // version_40
  40: async (db) => {
    const insert = 'INSERT INTO settings VALUES (?, ?)';
    await db.exec(insert, ['integration_hipchat', '0']);
    await db.exec(insert, ['integration_hipchat_api_url', 'https://api.hipchat.com']);
    await db.exec(insert, ['integration_hipchat_room_id', '']);
    await db.exec(insert, ['integration_hipchat_room_token', '']);
  },

  // version_41
  41: async (db) => {
    await db.exec('INSERT INTO settings VALUES (?, ?)', ['integration_gravatar', '0']);
  },

  // version_42
  42: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN twofactor_activated BOOLEAN DEFAULT '0'`);
    await db.exec(`ALTER TABLE users ADD COLUMN twofactor_secret CHAR(16)`);
  },

  // version_43
  43: async (db) => {
    await db.exec(`ALTER TABLE files ADD COLUMN "date" INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE files ADD COLUMN "user_id" INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE files ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0`);
  },

  // version_44
  44: async (db) => {
    await db.exec(`ALTER TABLE project_has_categories ADD COLUMN description TEXT`);
  },

  // version_45
  45: async (db) => {
    await db.exec(`ALTER TABLE project_daily_summaries ADD COLUMN score INTEGER NOT NULL DEFAULT 0`);
  },

  // version_46
  46: async (db) => {
    await db.exec(`
        CREATE TABLE project_integrations (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL UNIQUE,
            hipchat BOOLEAN DEFAULT '0',
            hipchat_api_url VARCHAR(255) DEFAULT 'https://api.hipchat.com',
            hipchat_room_id VARCHAR(255),
            hipchat_room_token VARCHAR(255),
            slack BOOLEAN DEFAULT '0',
            slack_webhook_url VARCHAR(255),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);
  },

  // version_47
  47: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN identifier VARCHAR(50) DEFAULT ''`);
  },

  // version_48
  48: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_status INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_trigger INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_factor INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_timeframe INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_basedate INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_parent INTEGER`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_child INTEGER`);
  },

  // version_49
  49: async (db) => {
    const insert = 'INSERT INTO settings VALUES (?, ?)';
    await db.exec(insert, ['integration_jabber', '0']);
    await db.exec(insert, ['integration_jabber_server', '']);
    await db.exec(insert, ['integration_jabber_domain', '']);
    await db.exec(insert, ['integration_jabber_username', '']);
    await db.exec(insert, ['integration_jabber_password', '']);
    await db.exec(insert, ['integration_jabber_nickname', 'kanboard']);
    await db.exec(insert, ['integration_jabber_room', '']);

    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber INTEGER DEFAULT '0'`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_server VARCHAR(255) DEFAULT ''`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_domain VARCHAR(255) DEFAULT ''`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_username VARCHAR(255) DEFAULT ''`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_password VARCHAR(255) DEFAULT ''`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_nickname VARCHAR(255) DEFAULT 'kanboard'`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_room VARCHAR(255) DEFAULT ''`);
  },

  // version_50
  50: async (db) => {
    const insert = 'INSERT INTO settings VALUES (?, ?)';
    await db.exec(insert, ['calendar_user_subtasks_time_tracking', 0]);
    await db.exec(insert, ['calendar_user_tasks', 'date_started']);
    await db.exec(insert, ['calendar_project_tasks', 'date_started']);

    await db.exec(`DELETE FROM settings WHERE option='subtask_forecast'`);
  },

  // version_51
  51: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN token VARCHAR(255) DEFAULT ''`);
  },

  // version_52
  52: async (db) => {
    await db.exec('INSERT INTO settings VALUES (?, ?)', ['webhook_url', '']);

    await db.exec(`DELETE FROM settings WHERE option='webhook_url_task_creation'`);
    await db.exec(`DELETE FROM settings WHERE option='webhook_url_task_modification'`);
  },

  // version_53
  53: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN notifications_filter INTEGER DEFAULT 4`);
  },

  // version_54
  54: async (db) => {
    await db.exec(`ALTER TABLE project_has_categories ALTER COLUMN project_id SET NOT NULL`);
    await db.exec(`ALTER TABLE project_has_categories ALTER COLUMN name SET NOT NULL`);
    await db.exec(`ALTER TABLE actions ALTER COLUMN project_id SET NOT NULL`);
    await db.exec(`ALTER TABLE actions ALTER COLUMN event_name SET NOT NULL`);
    await db.exec(`ALTER TABLE actions ALTER COLUMN action_name SET NOT NULL`);
    await db.exec(`ALTER TABLE action_has_params ALTER COLUMN action_id SET NOT NULL`);
    await db.exec(`ALTER TABLE action_has_params ALTER COLUMN name SET NOT NULL`);
    await db.exec(`ALTER TABLE action_has_params ALTER COLUMN value SET NOT NULL`);
    await db.exec(`ALTER TABLE files ALTER COLUMN name SET NOT NULL`);
    await db.exec(`ALTER TABLE files ALTER COLUMN task_id SET NOT NULL`);
    await db.exec(`ALTER TABLE subtasks ALTER COLUMN title SET NOT NULL`);
    await db.exec(`ALTER TABLE tasks ALTER COLUMN title SET NOT NULL`);
    await db.exec(`ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL`);
    await db.exec(`ALTER TABLE tasks ALTER COLUMN column_id SET NOT NULL`);
    await db.exec(`ALTER TABLE columns ALTER COLUMN title SET NOT NULL`);
    await db.exec(`ALTER TABLE columns ALTER COLUMN project_id SET NOT NULL`);
    await db.exec(`ALTER TABLE project_has_users ALTER COLUMN project_id SET NOT NULL`);
    await db.exec(`ALTER TABLE project_has_users ALTER COLUMN user_id SET NOT NULL`);
    await db.exec(`ALTER TABLE projects ALTER COLUMN name SET NOT NULL`);
    await db.exec(`ALTER TABLE users ALTER COLUMN username SET NOT NULL`);
    await db.exec(`ALTER TABLE user_has_notifications ALTER COLUMN user_id SET NOT NULL`);
    await db.exec(`ALTER TABLE user_has_notifications ALTER COLUMN user_id SET NOT NULL`);
  },

  // version_55
  55: async (db) => {
    await db.exec(`ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey`);
    await db.exec(`ALTER TABLE comments ALTER COLUMN task_id SET NOT NULL`);
    await db.exec(`ALTER TABLE comments ALTER COLUMN user_id SET DEFAULT 0`);
    await db.exec(`ALTER TABLE comments RENAME COLUMN "date" TO "date_creation"`);
    await db.exec(`ALTER TABLE comments ALTER COLUMN date_creation SET NOT NULL`);
  },

  // version_56
  56: async (db) => {
    await db.exec(`DELETE FROM "settings" WHERE "option"='subtask_time_tracking'`);
  },

  // version_57
  57: async (db) => {
    await db.exec(`ALTER TABLE users DROP COLUMN "default_project_id"`);
  },

  // version_58
  58: async (db) => {
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN slack_webhook_channel VARCHAR(255) DEFAULT ''`);
    await db.exec(`INSERT INTO settings VALUES ('integration_slack_webhook_channel', '')`);
  },

  // version_59
  59: async (db) => {
    await db.exec(`
        CREATE TABLE project_daily_stats (
            id SERIAL PRIMARY KEY,
            day CHAR(10) NOT NULL,
            project_id INTEGER NOT NULL,
            avg_lead_time INTEGER NOT NULL DEFAULT 0,
            avg_cycle_time INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`CREATE UNIQUE INDEX project_daily_stats_idx ON project_daily_stats(day, project_id)`);
    await db.exec(`ALTER TABLE project_daily_summaries RENAME TO project_daily_column_stats`);
  },

  // version_60
  60: async (db) => {
    await db.exec(`INSERT INTO settings VALUES ('default_color', 'yellow')`);
  },

  // version_61
  61: async (db) => {
    await db.exec(`INSERT INTO settings VALUES ('subtask_time_tracking', '1')`);
    await db.exec(`INSERT INTO settings VALUES ('cfd_include_closed_tasks', '1')`);
  },

  // version_62
  62: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN nb_failed_login INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE users ADD COLUMN lock_expiration_date INTEGER DEFAULT 0`);
  },

  // version_63
  63: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN is_project_admin BOOLEAN DEFAULT '0'`);
  },

  // version_64
  64: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN start_date VARCHAR(10) DEFAULT ''`);
    await db.exec(`ALTER TABLE projects ADD COLUMN end_date VARCHAR(10) DEFAULT ''`);
  },

  // version_65
  65: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN gitlab_id INTEGER`);
  },

  // version_66
  66: async (db) => {
    await db.exec(`ALTER TABLE swimlanes ADD COLUMN description TEXT`);
  },

  // version_67
  67: async (db) => {
    await db.exec(`
        CREATE TABLE plugin_schema_versions (
            plugin VARCHAR(80) NOT NULL PRIMARY KEY,
            version INTEGER NOT NULL DEFAULT 0
        )
    `);
  },

  // version_68
  68: async (db) => {
    await db.exec(`
        CREATE TABLE custom_filters (
            id SERIAL PRIMARY KEY,
            filter VARCHAR(100) NOT NULL,
            project_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            is_shared BOOLEAN DEFAULT '0'
        )
    `);
  },

  // version_69
  69: async (db) => {
    await db.exec(`
        CREATE TABLE user_has_unread_notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            date_creation BIGINT NOT NULL,
            event_name VARCHAR(50) NOT NULL,
            event_data TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.exec(`
        CREATE TABLE user_has_notification_types (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            notification_type VARCHAR(50),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await db.exec(`CREATE UNIQUE INDEX user_has_notification_types_user_idx ON user_has_notification_types(user_id, notification_type)`);

    // Migrate people who have notification enabled before
    const { rows: users } = await db.exec("SELECT id FROM users WHERE notifications_enabled='1'");

    for (const user of users) {
      await db.exec('INSERT INTO user_has_notification_types (user_id, notification_type) VALUES (?, ?)', [user.id as number, 'email']);
    }
  },

  // version_70
  70: async (db) => {
    await db.exec(`ALTER TABLE tasks ALTER COLUMN date_due TYPE BIGINT`);
    await db.exec(`ALTER TABLE tasks ALTER COLUMN date_creation TYPE BIGINT`);
    await db.exec(`ALTER TABLE tasks ALTER COLUMN date_completed TYPE BIGINT`);
    await db.exec(`ALTER TABLE tasks ALTER COLUMN date_started TYPE BIGINT`);
    await db.exec(`ALTER TABLE tasks ALTER COLUMN date_moved TYPE BIGINT`);
    await db.exec(`ALTER TABLE comments ALTER COLUMN date_creation TYPE BIGINT`);
    await db.exec(`ALTER TABLE last_logins ALTER COLUMN date_creation TYPE BIGINT`);
    await db.exec(`ALTER TABLE project_activities ALTER COLUMN date_creation TYPE BIGINT`);
    await db.exec(`ALTER TABLE projects ALTER COLUMN last_modified TYPE BIGINT`);
    await db.exec(`ALTER TABLE remember_me ALTER COLUMN date_creation TYPE BIGINT`);
    await db.exec(`ALTER TABLE files ALTER COLUMN "date" TYPE BIGINT`);
    await db.exec(`ALTER TABLE transitions ALTER COLUMN "date" TYPE BIGINT`);
    await db.exec(`ALTER TABLE subtask_time_tracking ALTER COLUMN "start" TYPE BIGINT`);
    await db.exec(`ALTER TABLE subtask_time_tracking ALTER COLUMN "end" TYPE BIGINT`);
    await db.exec(`ALTER TABLE users ALTER COLUMN "lock_expiration_date" TYPE BIGINT`);
  },

  // version_71
  71: async (db) => {
    await db.exec(`ALTER TABLE custom_filters ADD COLUMN "append" BOOLEAN DEFAULT '0'`);
  },

  // version_72
  72: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_notification_types (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            notification_type VARCHAR(50) NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, notification_type)
        )
    `);
  },

  // version_73
  73: async (db) => {
    await db.exec(`
        CREATE TABLE user_has_metadata (
            user_id INTEGER NOT NULL,
            name VARCHAR(50) NOT NULL,
            value VARCHAR(255) DEFAULT '',
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        )
    `);
    await db.exec(`
        CREATE TABLE project_has_metadata (
            project_id INTEGER NOT NULL,
            name VARCHAR(50) NOT NULL,
            value VARCHAR(255) DEFAULT '',
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, name)
        )
    `);
    await db.exec(`
        CREATE TABLE task_has_metadata (
            task_id INTEGER NOT NULL,
            name VARCHAR(50) NOT NULL,
            value VARCHAR(255) DEFAULT '',
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            UNIQUE(task_id, name)
        )
    `);
    await db.exec(`DROP TABLE project_integrations`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_jabber'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_jabber_server'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_jabber_domain'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_jabber_username'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_jabber_password'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_jabber_nickname'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_jabber_room'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_hipchat'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_hipchat_api_url'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_hipchat_room_id'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_hipchat_room_token'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_slack_webhook'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_slack_webhook_url'`);
    await db.exec(`DELETE FROM settings WHERE "option"='integration_slack_webhook_channel'`);
  },

  // version_74
  74: async (db) => {
    await db.exec(`ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_name_key`);
  },

  // version_75
  75: async (db) => {
    await db.exec(`
        CREATE TABLE groups (
            id SERIAL PRIMARY KEY,
            external_id VARCHAR(255) DEFAULT '',
            name VARCHAR(100) NOT NULL UNIQUE
        )
    `);
    await db.exec(`
        CREATE TABLE group_has_users (
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(group_id, user_id)
        )
    `);
  },

  // version_76
  76: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_groups (
            group_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            role VARCHAR(25) NOT NULL,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(group_id, project_id)
        )
    `);

    await db.exec(`ALTER TABLE project_has_users ADD COLUMN role VARCHAR(25) NOT NULL DEFAULT '${Role.PROJECT_VIEWER}'`);

    const { rows } = await db.exec('SELECT * FROM project_has_users');

    for (const row of rows) {
      await db.exec('UPDATE project_has_users SET "role"=? WHERE "id"=?', [equalsOne(row.is_owner) ? Role.PROJECT_MANAGER : Role.PROJECT_MEMBER, row.id as number]);
    }

    await db.exec(`ALTER TABLE project_has_users DROP COLUMN "is_owner"`);
    await db.exec(`ALTER TABLE project_has_users DROP COLUMN "id"`);
  },

  // version_77
  77: async (db) => {
    await db.exec(`ALTER TABLE "users" ADD COLUMN "role" VARCHAR(25) NOT NULL DEFAULT '${Role.APP_USER}'`);

    const { rows } = await db.exec('SELECT * FROM "users"');

    for (const row of rows) {
      let role: string = Role.APP_USER;

      if (equalsOne(row.is_admin)) {
        role = Role.APP_ADMIN;
      } else if (isTruthy(row.is_project_admin)) {
        role = Role.APP_MANAGER;
      }

      await db.exec('UPDATE "users" SET "role"=? WHERE "id"=?', [role, row.id as number]);
    }

    await db.exec(`ALTER TABLE users DROP COLUMN "is_admin"`);
    await db.exec(`ALTER TABLE users DROP COLUMN "is_project_admin"`);
  },

  // version_78
  78: async (db) => {
    await db.exec(`ALTER TABLE "users" ALTER COLUMN "language" TYPE VARCHAR(5)`);
  },

  // version_79
  79: async (db) => {
    const { rows } = await db.exec('SELECT * FROM actions');

    for (const row of rows) {
      let actionName = String(row.action_name);

      if (actionName === 'TaskAssignCurrentUser' && row.event_name === 'task.move.column') {
        actionName = '\\Kanboard\\Action\\TaskAssignCurrentUserColumn';
      } else if (actionName === 'TaskClose' && row.event_name === 'task.move.column') {
        actionName = '\\Kanboard\\Action\\TaskCloseColumn';
      } else if (actionName === 'TaskLogMoveAnotherColumn') {
        actionName = '\\Kanboard\\Action\\CommentCreationMoveTaskColumn';
      } else if (actionName[0] !== '\\') {
        actionName = `\\Kanboard\\Action\\${actionName}`;
      }

      await db.exec('UPDATE actions SET action_name=? WHERE id=?', [actionName, row.id as number]);
    }
  },

  // version_80
  80: async (db) => {
    await db.exec(`ALTER TABLE "actions" ALTER COLUMN "action_name" TYPE VARCHAR(255)`);
  },

  // version_81
  81: async (db) => {
    await db.exec(`
        CREATE TABLE password_reset (
            token VARCHAR(80) PRIMARY KEY,
            user_id INTEGER NOT NULL,
            date_expiration INTEGER NOT NULL,
            date_creation INTEGER NOT NULL,
            ip VARCHAR(45) NOT NULL,
            user_agent VARCHAR(255) NOT NULL,
            is_active BOOLEAN NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`INSERT INTO settings VALUES ('password_reset', '1')`);
  },

  // version_82
  82: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN owner_id INTEGER DEFAULT 0`);
  },

  // version_83
  83: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN priority_default INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE projects ADD COLUMN priority_start INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE projects ADD COLUMN priority_end INTEGER DEFAULT 3`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0`);
  },

  // version_84
  84: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_external_links (
            id SERIAL PRIMARY KEY,
            link_type VARCHAR(100) NOT NULL,
            dependency VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            url VARCHAR(255) NOT NULL,
            date_creation INT NOT NULL,
            date_modification INT NOT NULL,
            task_id INT NOT NULL,
            creator_id INT DEFAULT 0,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);
  },

  // version_85
  85: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT '1'`);
  },

  // version_86
  86: async (db) => {
    await db.exec(`ALTER TABLE files RENAME TO task_has_files`);
    await db.exec(`
        CREATE TABLE project_has_files (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            name VARCHAR(255) NOT NULL,
            path VARCHAR(255) NOT NULL,
            is_image BOOLEAN DEFAULT '0',
            size INTEGER DEFAULT 0 NOT NULL,
            user_id INTEGER DEFAULT 0 NOT NULL,
            date INTEGER DEFAULT 0 NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);
  },

  // version_87
  87: async (db) => {
    await db.exec(`UPDATE project_activities SET event_name='task.file.create' WHERE event_name='file.create'`);
  },

  // version_88
  88: async (db) => {
    await db.exec(`ALTER TABLE user_has_metadata ADD COLUMN changed_by INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE user_has_metadata ADD COLUMN changed_on INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE project_has_metadata ADD COLUMN changed_by INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE project_has_metadata ADD COLUMN changed_on INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE task_has_metadata ADD COLUMN changed_by INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE task_has_metadata ADD COLUMN changed_on INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE settings ADD COLUMN changed_by INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE settings ADD COLUMN changed_on INTEGER DEFAULT 0 NOT NULL`);
  },

  // version_89
  89: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255)`);
  },

  // version_90
  90: async (db) => {
    await db.exec(`
        CREATE TABLE tags (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            project_id INTEGER NOT NULL,
            UNIQUE(project_id, name)
        )
    `);
    await db.exec(`
        CREATE TABLE task_has_tags (
            task_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            UNIQUE(tag_id, task_id)
        )
    `);
  },

  // version_91
  91: async (db) => {
    await db.exec(`ALTER TABLE columns ADD COLUMN hide_in_dashboard BOOLEAN DEFAULT '0'`);
  },

  // version_92
  92: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_roles (
            role_id SERIAL PRIMARY KEY,
            role VARCHAR(255) NOT NULL,
            project_id INTEGER NOT NULL,
            UNIQUE(project_id, role),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`
        CREATE TABLE column_has_move_restrictions (
            restriction_id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            src_column_id INTEGER NOT NULL,
            dst_column_id INTEGER NOT NULL,
            UNIQUE(role_id, src_column_id, dst_column_id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(role_id) REFERENCES project_has_roles(role_id) ON DELETE CASCADE,
            FOREIGN KEY(src_column_id) REFERENCES columns(id) ON DELETE CASCADE,
            FOREIGN KEY(dst_column_id) REFERENCES columns(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`ALTER TABLE "project_has_users" ALTER COLUMN "role" TYPE VARCHAR(255)`);
    await db.exec(`ALTER TABLE "project_has_groups" ALTER COLUMN "role" TYPE VARCHAR(255)`);
  },

  // version_93
  93: async (db) => {
    await db.exec(`
        CREATE TABLE project_role_has_restrictions (
            restriction_id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            rule VARCHAR(255) NOT NULL,
            UNIQUE(role_id, rule),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(role_id) REFERENCES project_has_roles(role_id) ON DELETE CASCADE
        )
    `);
  },

  // version_94
  94: async (db) => {
    await db.exec(`
        CREATE TABLE column_has_restrictions (
            restriction_id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            column_id INTEGER NOT NULL,
            rule VARCHAR(255) NOT NULL,
            UNIQUE(role_id, column_id, rule),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(role_id) REFERENCES project_has_roles(role_id) ON DELETE CASCADE,
            FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE
        )
    `);
  },

  // version_95
  95: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN external_provider VARCHAR(255)`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN external_uri VARCHAR(255)`);
  },

  // version_96
  96: async (db) => {
    await db.exec(`ALTER TABLE "settings" ALTER COLUMN "value" TYPE TEXT`);
  },

  // version_97
  97: async (db) => {
    await db.exec(`ALTER TABLE "users" ADD COLUMN api_access_token VARCHAR(255) DEFAULT NULL`);
  },

  // version_98
  98: async (db) => {
    await db.exec(`ALTER TABLE "comments" ADD COLUMN date_modification BIGINT`);
    await db.exec(`UPDATE "comments" SET date_modification = date_creation WHERE date_modification IS NULL`);
  },

  // version_99
  99: async (db) => {
    await db.exec(`
        CREATE TABLE invites (
            email VARCHAR(255) NOT NULL,
            project_id INTEGER NOT NULL,
            token VARCHAR(255) NOT NULL,
            PRIMARY KEY(email, token)
        )
    `);
    await db.exec(`DELETE FROM settings WHERE "option"='application_datetime_format'`);
  },

  // version_100
  100: async (db) => {
    await db.exec(`ALTER TABLE "projects" ADD COLUMN email VARCHAR(255)`);
  },

  // version_101
  101: async (db) => {
    await migrateDefaultSwimlane(db);

    await db.exec(`ALTER TABLE "projects" DROP COLUMN "default_swimlane"`);
    await db.exec(`ALTER TABLE "projects" DROP COLUMN "show_default_swimlane"`);
    await db.exec(`ALTER TABLE "tasks" ALTER COLUMN "swimlane_id" SET NOT NULL`);
    await db.exec(`ALTER TABLE "tasks" ALTER COLUMN "swimlane_id" DROP DEFAULT`);
    await db.exec(`ALTER TABLE "tasks" ADD FOREIGN KEY (swimlane_id) REFERENCES swimlanes ON DELETE CASCADE`);
  },

  // version_102
  102: async (db) => {
    await db.exec(`ALTER TABLE column_has_move_restrictions ADD COLUMN only_assigned BOOLEAN DEFAULT FALSE`);
  },

  // version_103
  103: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN predefined_email_subjects TEXT`);
  },

  // version_104
  104: async (db) => {
    await db.exec(`ALTER TABLE projects DROP COLUMN is_everybody_allowed`);
  },

  // version_105
  105: async (db) => {
    await db.exec(`CREATE TABLE predefined_task_descriptions (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`);
  },

  // version_106
  106: async (db) => {
    await db.exec(`CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        expire_at INTEGER NOT NULL,
        data TEXT DEFAULT ''
    )`);
  },

  // version_107
  107: async (db) => {
    await db.exec(`ALTER TABLE "users" ADD COLUMN filter VARCHAR(255) DEFAULT NULL`);
  },

  // version_108
  108: async (db) => {
    await db.exec(`ALTER TABLE "projects" ALTER COLUMN "name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "projects" ALTER COLUMN "email" TYPE TEXT`);
    await db.exec(`ALTER TABLE "action_has_params" ALTER COLUMN "name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "action_has_params" ALTER COLUMN "value" TYPE TEXT`);
    await db.exec(`ALTER TABLE "actions" ALTER COLUMN "event_name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "actions" ALTER COLUMN "action_name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "comments" ALTER COLUMN "reference" TYPE TEXT`);
    await db.exec(`ALTER TABLE "custom_filters" ALTER COLUMN "filter" TYPE TEXT`);
    await db.exec(`ALTER TABLE "custom_filters" ALTER COLUMN "name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "groups" ALTER COLUMN "name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "project_activities" ALTER COLUMN "event_name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "project_has_files" ALTER COLUMN "name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "project_has_files" ALTER COLUMN "path" TYPE TEXT`);
    await db.exec(`ALTER TABLE "subtasks" ALTER COLUMN "title" TYPE TEXT`);
    await db.exec(`ALTER TABLE "swimlanes" ALTER COLUMN "name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "task_has_external_links" ALTER COLUMN "title" TYPE TEXT`);
    await db.exec(`ALTER TABLE "task_has_external_links" ALTER COLUMN "url" TYPE TEXT`);
    await db.exec(`ALTER TABLE "task_has_files" ALTER COLUMN "name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "task_has_files" ALTER COLUMN "path" TYPE TEXT`);
    await db.exec(`ALTER TABLE "tasks" ALTER COLUMN "title" TYPE TEXT`);
    await db.exec(`ALTER TABLE "tasks" ALTER COLUMN "reference" TYPE TEXT`);
    await db.exec(`ALTER TABLE "user_has_unread_notifications" ALTER COLUMN "event_name" TYPE TEXT`);
    await db.exec(`ALTER TABLE "users" ALTER COLUMN "username" TYPE TEXT`);
    await db.exec(`ALTER TABLE "users" ALTER COLUMN "filter" TYPE TEXT`);
  },

  // version_109
  109: async (db) => {
    await db.exec(`ALTER TABLE "users" ALTER COLUMN "language" TYPE VARCHAR(11)`);
  },

  // version_110
  110: async (db) => {
    await db.exec(`ALTER TABLE "project_has_categories" ADD COLUMN "color_id" VARCHAR(50) DEFAULT NULL`);
  },

  // version_111
  111: async (db) => {
    await db.exec(`ALTER TABLE "tags" ADD COLUMN "color_id" VARCHAR(50) DEFAULT NULL`);
  },

  // version_112
  112: async (db) => {
    await db.exec(`ALTER TABLE "projects" ADD COLUMN per_swimlane_task_limits BOOLEAN DEFAULT FALSE`);
  },

  // version_113
  113: async (db) => {
    await db.exec(`ALTER TABLE "projects" ADD COLUMN task_limit INTEGER DEFAULT 0`);
  },

  // version_114
  114: async (db) => {
    await db.exec(`ALTER TABLE "swimlanes" ADD COLUMN task_limit INTEGER DEFAULT 0`);
  },

  // version_115
  115: async (db) => {
    await db.exec(`ALTER TABLE "projects" ADD COLUMN enable_global_tags BOOLEAN DEFAULT TRUE`);
  },

  // version_116
  116: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light' NOT NULL`);
  },

  // version_117
  117: async (db) => {
    await db.exec(`ALTER TABLE "comments" ADD COLUMN "visibility" VARCHAR(25) NOT NULL DEFAULT '${Role.APP_USER}'`);
  },
};

export const postgresSchema: SchemaDefinition = {
  driver: 'postgres',
  latestVersion: POSTGRES_SCHEMA_VERSION,
  migrations,
};

import { getToken } from '../../core/security/token.js';
import type { Database } from '../database.js';
import type { MigrationFunction, SchemaDefinition } from './types.js';

/**
 * SQLite schema, a port of `app/Schema/Sqlite.php` (versions 1 to 128, same statements in the same order).
 * Versions 49 to 51 do not exist in the PHP code base and are therefore no-ops.
 */
export const SQLITE_SCHEMA_VERSION = 128;

/** bcrypt hash of the default `admin` password (`password_hash('admin', PASSWORD_BCRYPT)`). */
const DEFAULT_ADMIN_PASSWORD_HASH = '$2y$10$GzDCeQl/GdH.pCZfz4fWdO3qmayutRCmxEIY9U9t1k9q9F89VNDCm';

const generateToken = getToken;

/** Port of `Schema\migrate_default_swimlane()`. */
async function migrateDefaultSwimlane(db: Database): Promise<void> {
  const { rows: projects } = await db.exec('SELECT * FROM projects');

  for (const project of projects) {
    let defaultSwimlane = project.default_swimlane ? String(project.default_swimlane) : 'Default swimlane';

    const existing = await db.exec('SELECT 1 FROM swimlanes WHERE name=? AND project_id=?', [defaultSwimlane, project.id as number]);

    if (existing.rows.length > 0) {
      defaultSwimlane = `${defaultSwimlane} (Default swimlane)`;
    }

    // Create new default swimlane
    const show = Number(project.show_default_swimlane) || 0;
    const inserted = await db.exec('INSERT INTO swimlanes (project_id, name, is_active, position) VALUES (?, ?, ?, ?)', [
      project.id as number,
      defaultSwimlane,
      show,
      show === 1 ? 1 : 0,
    ]);
    const swimlaneId = inserted.insertId as number;

    // Reorder swimlanes if the default one was active
    if (show) {
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
            language TEXT DEFAULT 'en_US',
            webhooks_token TEXT DEFAULT ''
        )
    `);
    await db.exec(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            password TEXT,
            is_admin INTEGER DEFAULT 0
        )
    `);
    await db.exec(`
        CREATE TABLE projects (
            id INTEGER PRIMARY KEY,
            name TEXT NOCASE NOT NULL,
            is_active INTEGER DEFAULT 1
        )
    `);
    await db.exec(`
        CREATE TABLE columns (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            position INTEGER,
            project_id INTEGER NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (title, project_id)
        )
    `);
    await db.exec(`
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY,
            title TEXT NOCASE NOT NULL,
            description TEXT,
            date_creation INTEGER,
            color_id TEXT,
            project_id INTEGER,
            column_id INTEGER,
            owner_id INTEGER DEFAULT '0',
            position INTEGER,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`
          INSERT INTO users
          (username, password, is_admin)
          VALUES ('admin', '${DEFAULT_ADMIN_PASSWORD_HASH}', '1')
      `);

    await db.exec(`
          INSERT INTO config
          (webhooks_token)
          VALUES ('${generateToken()}')
      `);
  },

  // version_2
  2: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_completed INTEGER`);
    await db.exec(`UPDATE tasks SET date_completed=date_creation WHERE is_active=0`);
  },

  // version_3
  3: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN token TEXT`);
  },

  // version_4
  4: async (db) => {
    await db.exec(`ALTER TABLE config ADD COLUMN timezone TEXT DEFAULT 'UTC'`);
  },

  // version_5
  5: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN score INTEGER`);
  },

  // version_6
  6: async (db) => {
    await db.exec(`ALTER TABLE columns ADD COLUMN task_limit INTEGER DEFAULT '0'`);
  },

  // version_7
  7: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_users (
            project_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(project_id, user_id)
        )
    `);
  },

  // version_8
  8: async (db) => {
    await db.exec(`CREATE TABLE comments (
            id INTEGER PRIMARY KEY,
            task_id INTEGER,
            user_id INTEGER,
            date INTEGER,
            comment TEXT,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`);
  },

  // version_9
  9: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_due INTEGER`);
  },

  // version_10
  10: async (db) => {
    await db.exec(`CREATE TABLE actions (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            event_name TEXT NOT NULL,
            action_name TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);
    await db.exec(`CREATE TABLE action_has_params (
            id INTEGER PRIMARY KEY,
            action_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            value TEXT NOT NULL,
            FOREIGN KEY(action_id) REFERENCES actions(id) ON DELETE CASCADE
        )`);
  },

  // version_11
  11: async (db) => {
    await db.exec(`ALTER TABLE comments RENAME TO comments_bak`);
    await db.exec(`CREATE TABLE comments (
            id INTEGER PRIMARY KEY,
            task_id INTEGER,
            user_id INTEGER,
            date INTEGER,
            comment TEXT,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);
    await db.exec(`INSERT INTO comments SELECT * FROM comments_bak`);
    await db.exec(`DROP TABLE comments_bak`);
  },

  // version_12
  12: async (db) => {
    await db.exec(`CREATE TABLE remember_me (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            ip TEXT,
            user_agent TEXT,
            token TEXT,
            sequence TEXT,
            expiration INTEGER,
            date_creation INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);
    await db.exec(`CREATE TABLE last_logins (
            id INTEGER PRIMARY KEY,
            auth_type TEXT,
            user_id INTEGER NOT NULL,
            ip TEXT,
            user_agent TEXT,
            date_creation INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);
    await db.exec(`CREATE INDEX last_logins_user_idx ON last_logins(user_id)`);
  },

  // version_13
  13: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN is_ldap_user INTEGER DEFAULT 0`);
  },

  // version_14
  14: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN name TEXT`);
    await db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
    await db.exec(`ALTER TABLE users ADD COLUMN google_id TEXT`);
  },

  // version_15
  15: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN last_modified INTEGER DEFAULT 0`);
  },

  // version_16
  16: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_categories (
            id INTEGER PRIMARY KEY,
            name TEXT COLLATE NOCASE NOT NULL,
            project_id INTEGER NOT NULL,
            UNIQUE (project_id, name),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN category_id INTEGER DEFAULT 0`);
  },

  // version_17
  17: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_files (
            id INTEGER PRIMARY KEY,
            name TEXT COLLATE NOCASE NOT NULL,
            path TEXT,
            is_image INTEGER DEFAULT 0,
            task_id INTEGER NOT NULL,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`);
  },

  // version_18
  18: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_subtasks (
            id INTEGER PRIMARY KEY,
            title TEXT COLLATE NOCASE NOT NULL,
            status INTEGER DEFAULT 0,
            time_estimated NUMERIC DEFAULT 0,
            time_spent NUMERIC DEFAULT 0,
            task_id INTEGER NOT NULL,
            user_id INTEGER,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`);
  },

  // version_19
  19: async (db) => {
    await db.exec(`ALTER TABLE config ADD COLUMN api_token TEXT DEFAULT ''`);
    await db.exec(`UPDATE config SET api_token='${generateToken()}'`);
  },

  // version_20
  20: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN github_id TEXT`);
  },

  // version_21
  21: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN creator_id INTEGER DEFAULT '0'`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_modification INTEGER DEFAULT '0'`);
  },

  // version_22
  22: async (db) => {
    await db.exec(`ALTER TABLE config ADD COLUMN webhooks_url_task_modification TEXT`);
    await db.exec(`ALTER TABLE config ADD COLUMN webhooks_url_task_creation TEXT`);
  },

  // version_23
  23: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN notifications_enabled INTEGER DEFAULT '0'`);
    await db.exec(`
        CREATE TABLE user_has_notifications (
            user_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, user_id)
        );
    `);
  },

  // version_24
  24: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN is_public INTEGER DEFAULT "0"`);
  },

  // version_25
  25: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_events (
            id INTEGER PRIMARY KEY,
            date_creation INTEGER NOT NULL,
            event_name TEXT NOT NULL,
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
            id INTEGER PRIMARY KEY,
            date_creation INTEGER NOT NULL,
            event_name TEXT NOT NULL,
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
            id INTEGER PRIMARY KEY,
            date_creation INTEGER NOT NULL,
            event_name TEXT NOT NULL,
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

  // version_26
  26: async (db) => {
    await db.exec(`ALTER TABLE config ADD COLUMN default_columns TEXT DEFAULT ''`);
  },

  // version_27
  27: async (db) => {
    await db.exec(`CREATE UNIQUE INDEX users_username_idx ON users(username)`);
  },

  // version_28
  28: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN reference TEXT DEFAULT ''`);
    await db.exec(`ALTER TABLE comments ADD COLUMN reference TEXT DEFAULT ''`);
    await db.exec(`CREATE INDEX tasks_reference_idx ON tasks(reference)`);
    await db.exec(`CREATE INDEX comments_reference_idx ON comments(reference)`);
  },

  // version_29
  29: async (db) => {
    await db.exec(`
        CREATE TABLE settings (
            option TEXT PRIMARY KEY,
            value TEXT DEFAULT ''
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

    await db.exec('DROP TABLE config');
  },

  // version_30
  30: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['application_date_format', 'm/d/Y']);
  },

  // version_31
  31: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN is_private INTEGER DEFAULT "0"`);
  },

  // version_32
  32: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_started INTEGER`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN time_spent NUMERIC DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN time_estimated NUMERIC DEFAULT 0`);
  },

  // version_33
  33: async (db) => {
    await db.exec(`
        CREATE TABLE project_activities (
            id INTEGER PRIMARY KEY,
            date_creation INTEGER NOT NULL,
            event_name TEXT NOT NULL,
            creator_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
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

  // version_34
  34: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN is_everybody_allowed INTEGER DEFAULT "0"`);
  },

  // version_35
  35: async (db) => {
    await db.exec(`
        CREATE TABLE project_daily_summaries (
            id INTEGER PRIMARY KEY,
            day TEXT NOT NULL,
            project_id INTEGER NOT NULL,
            column_id INTEGER NOT NULL,
            total INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`CREATE UNIQUE INDEX project_daily_column_stats_idx ON project_daily_summaries(day, project_id, column_id)`);
  },

  // version_36
  36: async (db) => {
    await db.exec(`ALTER TABLE project_has_users ADD COLUMN is_owner INTEGER DEFAULT "0"`);
  },

  // version_37
  37: async (db) => {
    await db.exec(`
        CREATE TABLE swimlanes (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            position INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            project_id INTEGER NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (name, project_id)
        )
    `);
    await db.exec(`ALTER TABLE tasks ADD COLUMN swimlane_id INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE projects ADD COLUMN default_swimlane TEXT DEFAULT 'Default swimlane'`);
    await db.exec(`ALTER TABLE projects ADD COLUMN show_default_swimlane INTEGER DEFAULT 1`);
  },

  // version_38
  38: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['project_categories', '']);
  },

  // version_39
  39: async (db) => {
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
    const { rows } = await db.exec('SELECT id FROM projects WHERE is_private=1');

    for (const row of rows) {
      await db.exec('UPDATE project_has_users SET is_owner=1 WHERE project_id=?', [row.id]);
    }
  },

  // version_40
  40: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN timezone TEXT`);
    await db.exec(`ALTER TABLE users ADD COLUMN language TEXT`);
  },

  // version_41
  41: async (db) => {
    await db.exec(`ALTER TABLE columns ADD COLUMN description TEXT`);
  },

  // version_42
  42: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['subtask_restriction', '0']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['subtask_time_tracking', '0']);
    await db.exec(`
        CREATE TABLE subtask_time_tracking (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            subtask_id INTEGER NOT NULL,
            start INTEGER DEFAULT 0,
            end INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(subtask_id) REFERENCES task_has_subtasks(id) ON DELETE CASCADE
        )
    `);
  },

  // version_43
  43: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN disable_login_form INTEGER DEFAULT 0`);
  },

  // version_44
  44: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_moved INTEGER DEFAULT 0`);
    /* Update tasks.date_moved from project_activities table if tasks.date_moved = null or 0.
     * We take max project_activities.date_creation where event_name in task.create','task.move.column
     * since creation date is always less than task moves
    */
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
    // If there is no activities for some tasks use the date_creation
    await db.exec(`UPDATE tasks SET date_moved = date_creation WHERE date_moved IS NULL OR date_moved = 0`);
  },

  // version_45
  45: async (db) => {
    await db.exec(`CREATE TABLE links (
        id INTEGER PRIMARY KEY,
        label TEXT NOT NULL,
        opposite_id INTEGER DEFAULT 0,
        UNIQUE(label)
    )`);
    await db.exec(`CREATE TABLE task_has_links (
        id INTEGER PRIMARY KEY,
        link_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        opposite_task_id INTEGER NOT NULL,
        FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE CASCADE,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(opposite_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`);
    await db.exec(`CREATE INDEX task_has_links_task_index ON task_has_links(task_id)`);
    await db.exec(`CREATE UNIQUE INDEX task_has_links_unique ON task_has_links(link_id, task_id, opposite_task_id)`);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['relates to', 0]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['blocks', 3]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['is blocked by', 2]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['duplicates', 5]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['is duplicated by', 4]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['is a child of', 7]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['is a parent of', 6]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['targets milestone', 9]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['is a milestone of', 8]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['fixes', 11]);
    await db.exec(`INSERT INTO links (label, opposite_id) VALUES (?, ?)`, ['is fixed by', 10]);
  },

  // version_46
  46: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN description TEXT`);
  },

  // version_47
  47: async (db) => {
    await db.exec(`ALTER TABLE task_has_files RENAME TO files`);
    await db.exec(`ALTER TABLE task_has_subtasks RENAME TO subtasks`);
  },

  // version_48
  48: async (db) => {
    await db.exec(`ALTER TABLE subtasks ADD COLUMN position INTEGER DEFAULT 1`);
    // Migrate all subtasks position

    let taskId: unknown = 0;
    let position = 1;
    const { rows } = await db.exec('SELECT * FROM subtasks ORDER BY task_id, id ASC');

    for (const subtask of rows) {
      if (taskId !== subtask.task_id) {
        position = 1;
        taskId = subtask.task_id;
      }

      await db.exec('UPDATE subtasks SET position=? WHERE id=?', [position, subtask.id]);
      position++;
    }
  },

  // version_52
  52: async (db) => {
    await db.exec(`ALTER TABLE subtask_time_tracking ADD COLUMN time_spent REAL DEFAULT 0`);
  },

  // version_53
  53: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['application_stylesheet', '']);
  },

  // version_54
  54: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['subtask_forecast', '0']);
  },

  // version_55
  55: async (db) => {
    await db.exec(`CREATE TABLE transitions (
        "id" INTEGER PRIMARY KEY,
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

  // version_56
  56: async (db) => {
    await db.exec(`CREATE TABLE currencies ("currency" TEXT NOT NULL UNIQUE, "rate" REAL DEFAULT 0)`);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['application_currency', 'USD']);
  },

  // version_57
  57: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_slack_webhook', '0']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_slack_webhook_url', '']);
  },

  // version_58
  58: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_hipchat', '0']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_hipchat_api_url', 'https://api.hipchat.com']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_hipchat_room_id', '']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_hipchat_room_token', '']);
  },

  // version_59
  59: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_gravatar', '0']);
  },

  // version_60
  60: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN twofactor_activated INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE users ADD COLUMN twofactor_secret TEXT`);
  },

  // version_61
  61: async (db) => {
    await db.exec(`ALTER TABLE files ADD COLUMN "date" INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE files ADD COLUMN "user_id" INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE files ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0`);
  },

  // version_62
  62: async (db) => {
    await db.exec(`ALTER TABLE project_has_categories ADD COLUMN description TEXT`);
  },

  // version_63
  63: async (db) => {
    await db.exec(`ALTER TABLE project_daily_summaries ADD COLUMN score INTEGER NOT NULL DEFAULT 0`);
  },

  // version_64
  64: async (db) => {
    await db.exec(`
        CREATE TABLE project_integrations (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL UNIQUE,
            hipchat INTEGER DEFAULT 0,
            hipchat_api_url TEXT DEFAULT 'https://api.hipchat.com',
            hipchat_room_id TEXT,
            hipchat_room_token TEXT,
            slack INTEGER DEFAULT 0,
            slack_webhook_url TEXT,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);
  },

  // version_65
  65: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN identifier TEXT DEFAULT ''`);
  },

  // version_66
  66: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_status INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_trigger INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_factor INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_timeframe INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_basedate INTEGER NOT NULL DEFAULT 0`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_parent INTEGER`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_child INTEGER`);
  },

  // version_67
  67: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_jabber', '0']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_jabber_server', '']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_jabber_domain', '']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_jabber_username', '']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_jabber_password', '']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_jabber_nickname', 'kanboard']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['integration_jabber_room', '']);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber INTEGER DEFAULT '0'`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_server TEXT DEFAULT ''`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_domain TEXT DEFAULT ''`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_username TEXT DEFAULT ''`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_password TEXT DEFAULT ''`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_nickname TEXT DEFAULT 'kanboard'`);
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN jabber_room TEXT DEFAULT ''`);
  },

  // version_68
  68: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['calendar_user_subtasks_time_tracking', 0]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['calendar_user_tasks', 'date_started']);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['calendar_project_tasks', 'date_started']);
    await db.exec(`DELETE FROM settings WHERE option='subtask_forecast'`);
  },

  // version_69
  69: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN token TEXT DEFAULT ''`);
  },

  // version_70
  70: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, ['webhook_url', '']);
    await db.exec(`DELETE FROM settings WHERE option='webhook_url_task_creation'`);
    await db.exec(`DELETE FROM settings WHERE option='webhook_url_task_modification'`);
  },

  // version_71
  71: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN notifications_filter INTEGER DEFAULT 4`);
  },

  // version_72
  72: async (db) => {
    await db.exec(`ALTER TABLE comments RENAME TO comments_bak`);
    await db.exec(`CREATE TABLE comments (
            id INTEGER PRIMARY KEY,
            task_id INTEGER NOT NULL,
            user_id INTEGER DEFAULT 0,
            date_creation INTEGER NOT NULL,
            comment TEXT NOT NULL,
            reference VARCHAR(50),
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`);
    await db.exec(`INSERT INTO comments SELECT * FROM comments_bak`);
    await db.exec(`DROP TABLE comments_bak`);
  },

  // version_73
  73: async (db) => {
    await db.exec(`DELETE FROM settings WHERE option='subtask_time_tracking'`);
  },

  // version_74
  74: async (db) => {
    await db.exec(`ALTER TABLE project_integrations ADD COLUMN slack_webhook_channel TEXT DEFAULT ''`);
    await db.exec(`INSERT INTO settings VALUES ('integration_slack_webhook_channel', '')`);
  },

  // version_75
  75: async (db) => {
    await db.exec(`
        CREATE TABLE project_daily_stats (
            id INTEGER PRIMARY KEY,
            day TEXT NOT NULL,
            project_id INTEGER NOT NULL,
            avg_lead_time INTEGER NOT NULL DEFAULT 0,
            avg_cycle_time INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`CREATE UNIQUE INDEX project_daily_stats_idx ON project_daily_stats(day, project_id)`);
    await db.exec(`ALTER TABLE project_daily_summaries RENAME TO project_daily_column_stats`);
  },

  // version_76
  76: async (db) => {
    await db.exec(`INSERT INTO settings VALUES ('default_color', 'yellow')`);
  },

  // version_77
  77: async (db) => {
    await db.exec(`INSERT INTO settings VALUES ('subtask_time_tracking', '1')`);
    await db.exec(`INSERT INTO settings VALUES ('cfd_include_closed_tasks', '1')`);
  },

  // version_78
  78: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN nb_failed_login INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE users ADD COLUMN lock_expiration_date INTEGER DEFAULT 0`);
  },

  // version_79
  79: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN is_project_admin INTEGER DEFAULT 0`);
  },

  // version_80
  80: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN start_date TEXT DEFAULT ''`);
    await db.exec(`ALTER TABLE projects ADD COLUMN end_date TEXT DEFAULT ''`);
  },

  // version_81
  81: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN gitlab_id INTEGER`);
  },

  // version_82
  82: async (db) => {
    await db.exec(`ALTER TABLE swimlanes ADD COLUMN description TEXT`);
  },

  // version_83
  83: async (db) => {
    await db.exec(`
        CREATE TABLE plugin_schema_versions (
            plugin TEXT NOT NULL PRIMARY KEY,
            version INTEGER NOT NULL DEFAULT 0
        )
    `);
  },

  // version_84
  84: async (db) => {
    await db.exec(`
        CREATE TABLE custom_filters (
            id INTEGER PRIMARY KEY,
            filter TEXT NOT NULL,
            project_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            is_shared INTEGER DEFAULT 0
        )
    `);
  },

  // version_85
  85: async (db) => {
    await db.exec(`
        CREATE TABLE user_has_unread_notifications (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            date_creation INTEGER NOT NULL,
            event_name TEXT NOT NULL,
            event_data TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`
        CREATE TABLE user_has_notification_types (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            notification_type TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`CREATE UNIQUE INDEX user_has_notification_types_user_idx ON user_has_notification_types(user_id, notification_type)`);
    // Migrate people who have notification enabled before
    const { rows } = await db.exec('SELECT id FROM users WHERE notifications_enabled=1');

    for (const row of rows) {
      await db.exec('INSERT INTO user_has_notification_types (user_id, notification_type) VALUES (?, ?)', [row.id, 'email']);
    }
  },

  // version_86
  86: async (db) => {
    await db.exec(`ALTER TABLE custom_filters ADD COLUMN append INTEGER DEFAULT 0`);
  },

  // version_87
  87: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_notification_types (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            notification_type TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, notification_type)
        )
    `);
  },

  // version_88
  88: async (db) => {
    await db.exec(`
        CREATE TABLE user_has_metadata (
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            value TEXT DEFAULT '',
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        )
    `);
    await db.exec(`
        CREATE TABLE project_has_metadata (
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            value TEXT DEFAULT '',
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, name)
        )
    `);
    await db.exec(`
        CREATE TABLE task_has_metadata (
            task_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            value TEXT DEFAULT '',
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

  // version_89
  89: async (db) => {
    await db.exec(`
        CREATE TABLE groups (
            id INTEGER PRIMARY KEY,
            external_id TEXT DEFAULT '',
            name TEXT NOCASE NOT NULL UNIQUE
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

  // version_90
  90: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_groups (
            group_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(group_id, project_id)
        )
    `);
    await db.exec(`ALTER TABLE project_has_users ADD COLUMN role TEXT NOT NULL DEFAULT 'project-viewer'`);
    const { rows } = await db.exec('SELECT * FROM project_has_users');

    for (const row of rows) {
      await db.exec('UPDATE project_has_users SET "role"=? WHERE "user_id"=?', [
        Number(row.is_owner) === 1 ? 'project-manager' : 'project-member',
        row.user_id,
      ]);
    }
  },

  // version_91
  91: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'app-user'`);
    const { rows } = await db.exec('SELECT * FROM users');

    for (const row of rows) {
      let role = 'app-user';

      if (Number(row.is_admin) === 1) {
        role = 'app-admin';
      } else if (row.is_project_admin) {
        role = 'app-manager';
      }

      await db.exec('UPDATE users SET "role"=? WHERE "id"=?', [role, row.id]);
    }
  },

  // version_92
  92: async (db) => {
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
        actionName = '\\Kanboard\\Action\\' + actionName;
      }

      await db.exec('UPDATE actions SET action_name=? WHERE id=?', [actionName, row.id]);
    }
  },

  // version_93
  93: async (db) => {
    await db.exec(`
        CREATE TABLE password_reset (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            date_expiration INTEGER NOT NULL,
            date_creation INTEGER NOT NULL,
            ip TEXT NOT NULL,
            user_agent TEXT NOT NULL,
            is_active INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`INSERT INTO settings VALUES ('password_reset', '1')`);
  },

  // version_94
  94: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN owner_id INTEGER DEFAULT 0`);
  },

  // version_95
  95: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN priority_default INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE projects ADD COLUMN priority_start INTEGER DEFAULT 0`);
    await db.exec(`ALTER TABLE projects ADD COLUMN priority_end INTEGER DEFAULT 3`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0`);
  },

  // version_96
  96: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_external_links (
            id INTEGER PRIMARY KEY,
            link_type TEXT NOT NULL,
            dependency TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            date_creation INTEGER NOT NULL,
            date_modification INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            creator_id INTEGER DEFAULT 0,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);
  },

  // version_97
  97: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1`);
  },

  // version_98
  98: async (db) => {
    await db.exec(`ALTER TABLE files RENAME TO task_has_files`);
    await db.exec(`
        CREATE TABLE project_has_files (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            name TEXT COLLATE NOCASE NOT NULL,
            path TEXT NOT NULL,
            is_image INTEGER DEFAULT 0,
            size INTEGER DEFAULT 0 NOT NULL,
            user_id INTEGER DEFAULT 0 NOT NULL,
            date INTEGER DEFAULT 0 NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);
  },

  // version_99
  99: async (db) => {
    await db.exec(`UPDATE project_activities SET event_name='task.file.create' WHERE event_name='file.create'`);
  },

  // version_100
  100: async (db) => {
    await db.exec(`ALTER TABLE user_has_metadata ADD COLUMN changed_by INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE user_has_metadata ADD COLUMN changed_on INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE project_has_metadata ADD COLUMN changed_by INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE project_has_metadata ADD COLUMN changed_on INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE task_has_metadata ADD COLUMN changed_by INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE task_has_metadata ADD COLUMN changed_on INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE settings ADD COLUMN changed_by INTEGER DEFAULT 0 NOT NULL`);
    await db.exec(`ALTER TABLE settings ADD COLUMN changed_on INTEGER DEFAULT 0 NOT NULL`);
  },

  // version_101
  101: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN avatar_path TEXT`);
  },

  // version_102
  102: async (db) => {
    await db.exec(`
        CREATE TABLE tags (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
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

  // version_103
  103: async (db) => {
    await db.exec(`ALTER TABLE columns ADD COLUMN hide_in_dashboard INTEGER DEFAULT 0 NOT NULL`);
  },

  // version_104
  104: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_roles (
            role_id INTEGER PRIMARY KEY,
            role TEXT NOT NULL,
            project_id INTEGER NOT NULL,
            UNIQUE(project_id, role),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`
        CREATE TABLE column_has_move_restrictions (
            restriction_id INTEGER PRIMARY KEY,
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
  },

  // version_105
  105: async (db) => {
    await db.exec(`
        CREATE TABLE project_role_has_restrictions (
            restriction_id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            rule VARCHAR(255) NOT NULL,
            UNIQUE(role_id, rule),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(role_id) REFERENCES project_has_roles(role_id) ON DELETE CASCADE
        )
    `);
  },

  // version_106
  106: async (db) => {
    await db.exec(`
        CREATE TABLE column_has_restrictions (
            restriction_id INTEGER PRIMARY KEY,
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

  // version_107
  107: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN external_provider TEXT`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN external_uri TEXT`);
  },

  // version_108
  108: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN api_access_token VARCHAR(255) DEFAULT NULL`);
  },

  // version_109
  109: async (db) => {
    await db.exec(`ALTER TABLE comments ADD COLUMN date_modification INTEGER`);
    await db.exec(`UPDATE comments SET date_modification = date_creation WHERE date_modification IS NULL;`);
  },

  // version_110
  110: async (db) => {
    await db.exec(`
        CREATE TABLE invites (
            email TEXT NOT NULL,
            project_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            PRIMARY KEY(email, token)
        )
    `);
    await db.exec(`DELETE FROM settings WHERE "option"='application_datetime_format'`);
  },

  // version_111
  111: async (db) => {
    await db.exec(`ALTER TABLE "projects" ADD COLUMN email TEXT`);
  },

  // version_112
  112: async (db) => {
    await migrateDefaultSwimlane(db);
  },

  // version_113
  113: async (db) => {
    await db.exec(`ALTER TABLE project_activities RENAME TO project_activities_bak`);
    await db.exec(`
      CREATE TABLE project_activities (
          id INTEGER PRIMARY KEY,
          date_creation INTEGER NOT NULL,
          event_name TEXT NOT NULL,
          creator_id INTEGER NOT NULL,
          project_id INTEGER NOT NULL,
          task_id INTEGER NOT NULL,
          data TEXT,
          FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);
    await db.exec(`INSERT INTO project_activities SELECT * FROM project_activities_bak`);
    await db.exec(`DROP TABLE project_activities_bak`);
  },

  // version_114
  114: async (db) => {
    await db.exec(`ALTER TABLE column_has_move_restrictions ADD COLUMN only_assigned INTEGER DEFAULT 0`);
  },

  // version_115
  115: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN predefined_email_subjects TEXT`);
  },

  // version_116
  116: async (db) => {
    await db.exec(`CREATE TABLE predefined_task_descriptions (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`);
  },

  // version_117
  117: async (db) => {
    await db.exec(`CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        expire_at INTEGER NOT NULL,
        data TEXT DEFAULT ''
    )`);
  },

  // version_118
  118: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN filter TEXT`);
  },

  // version_119
  119: async (db) => {
    await db.exec(`ALTER TABLE project_has_categories ADD COLUMN color_id TEXT DEFAULT NULL`);
  },

  // version_120
  120: async (db) => {
    await db.exec(`ALTER TABLE tags ADD COLUMN color_id TEXT DEFAULT NULL`);
  },

  // version_121
  121: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN per_swimlane_task_limits INTEGER DEFAULT 0 NOT NULL`);
  },

  // version_122
  122: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN task_limit INTEGER DEFAULT 0`);
  },

  // version_123
  123: async (db) => {
    await db.exec(`ALTER TABLE swimlanes ADD COLUMN task_limit INTEGER DEFAULT 0`);
  },

  // version_124
  124: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN enable_global_tags INTEGER DEFAULT 1 NOT NULL`);
  },

  // version_125
  125: async (db) => {
    await db.exec(`
      CREATE TABLE tasks_new
        (
            id                   INTEGER PRIMARY KEY,
            title                TEXT NOCASE NOT NULL,
            description          TEXT,
            date_creation        INTEGER,
            color_id             TEXT,
            project_id           INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            column_id            INTEGER REFERENCES columns(id) ON DELETE CASCADE,
            owner_id             INTEGER DEFAULT '0',
            position             INTEGER,
            is_active            INTEGER DEFAULT 1,
            date_completed       INTEGER,
            score                INTEGER,
            date_due             INTEGER,
            category_id          INTEGER DEFAULT 0,
            creator_id           INTEGER DEFAULT '0',
            date_modification    INTEGER DEFAULT '0',
            reference            TEXT    DEFAULT '',
            date_started         INTEGER,
            time_spent           NUMERIC DEFAULT 0,
            time_estimated       NUMERIC DEFAULT 0,
            swimlane_id          INTEGER REFERENCES swimlanes(id) ON DELETE CASCADE,
            date_moved           INTEGER DEFAULT 0,
            recurrence_status    INTEGER DEFAULT 0 NOT NULL,
            recurrence_trigger   INTEGER DEFAULT 0 NOT NULL,
            recurrence_factor    INTEGER DEFAULT 0 NOT NULL,
            recurrence_timeframe INTEGER DEFAULT 0 NOT NULL,
            recurrence_basedate  INTEGER DEFAULT 0 NOT NULL,
            recurrence_parent    INTEGER,
            recurrence_child     INTEGER,
            priority             INTEGER DEFAULT 0,
            external_provider    TEXT,
            external_uri         TEXT
        )
    `);
    await db.exec(`INSERT INTO tasks_new SELECT * FROM tasks`);
    await db.exec(`DROP TABLE tasks`);
    await db.exec(`ALTER TABLE tasks_new RENAME TO tasks`);
  },

  // version_126
  126: async (db) => {
    await db.exec(`ALTER TABLE subtask_time_tracking RENAME TO subtask_time_tracking_old`);
    await db.exec(`
        CREATE TABLE subtask_time_tracking (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            subtask_id INTEGER NOT NULL,
            start INTEGER DEFAULT 0,
            end INTEGER DEFAULT 0,
            time_spent REAL DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
        )
    `);
    await db.exec(`DROP INDEX subtasks_task_idx`);
    await db.exec(`CREATE INDEX subtasks_task_idx ON subtasks(task_id)`);
    await db.exec(`INSERT INTO subtask_time_tracking SELECT * FROM subtask_time_tracking_old`);
    await db.exec(`DROP TABLE subtask_time_tracking_old`);
  },

  // version_127
  127: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light' NOT NULL`);
  },

  // version_128
  128: async (db) => {
    await db.exec(`ALTER TABLE comments ADD COLUMN visibility VARCHAR(25) NOT NULL DEFAULT 'app-user'`);
  },
};

export const sqliteSchema: SchemaDefinition = {
  driver: 'sqlite',
  latestVersion: SQLITE_SCHEMA_VERSION,
  migrations,
};

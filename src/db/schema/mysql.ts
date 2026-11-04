import { getToken } from "../../core/security/token.js";
import type { Database } from "../database.js";
import type { MigrationFunction, SchemaDefinition } from "./types.js";

/**
 * MySQL schema, a port of `app/Schema/Mysql.php` (versions 1 to 139, same statements in the same order).
 * Versions that do not exist in the PHP code base are no-ops.
 */
export const MYSQL_SCHEMA_VERSION = 139;

/** `Kanboard\Core\Security\Role` constants. */
const ROLE = {
  APP_ADMIN: "app-admin",
  APP_MANAGER: "app-manager",
  APP_USER: "app-user",
  APP_PUBLIC: "app-public",
  PROJECT_MANAGER: "project-manager",
  PROJECT_MEMBER: "project-member",
  PROJECT_VIEWER: "project-viewer",
} as const;

/** bcrypt hash of the default `admin` password (`password_hash('admin', PASSWORD_BCRYPT)`). */
const DEFAULT_ADMIN_PASSWORD_HASH =
  "$2y$10$GzDCeQl/GdH.pCZfz4fWdO3qmayutRCmxEIY9U9t1k9q9F89VNDCm";

const generateToken = getToken;

/** PHP truthiness of a database value (`"0"`, `0`, `null`, `""` are falsy). */
function phpTruthy(value: unknown): boolean {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "0" ||
    value === false
  ) {
    return false;
  }
  return typeof value === "number" || typeof value === "bigint"
    ? Number(value) !== 0
    : true;
}

/** Port of `Schema\migrate_default_swimlane()`. */
async function migrateDefaultSwimlane(db: Database): Promise<void> {
  const { rows: projects } = await db.exec("SELECT * FROM projects");

  for (const project of projects) {
    let defaultSwimlane = project.default_swimlane
      ? String(project.default_swimlane)
      : "Default swimlane";

    const existing = await db.exec(
      "SELECT 1 FROM swimlanes WHERE name=? AND project_id=?",
      [defaultSwimlane, project.id as number],
    );

    if (existing.rows.length > 0) {
      defaultSwimlane = `${defaultSwimlane} (Default swimlane)`;
    }

    // Create new default swimlane
    const show = Number(project.show_default_swimlane) || 0;
    const inserted = await db.exec(
      "INSERT INTO swimlanes (project_id, name, is_active, position) VALUES (?, ?, ?, ?)",
      [project.id as number, defaultSwimlane, show, show === 1 ? 1 : 0],
    );
    const swimlaneId = inserted.insertId as number;

    // Reorder swimlanes if the default one was active
    if (show) {
      await db.exec(
        "UPDATE swimlanes SET position=position+1 WHERE project_id=? AND is_active='1' AND id!=?",
        [project.id as number, swimlaneId],
      );
    }

    // Move all tasks to new swimlane
    await db.exec(
      "UPDATE tasks SET swimlane_id=? WHERE swimlane_id='0' AND project_id=?",
      [swimlaneId, project.id as number],
    );

    // Migrate automatic actions
    const { rows: params } = await db.exec(
      "SELECT action_has_params.id FROM action_has_params LEFT JOIN actions ON actions.id=action_has_params.action_id WHERE project_id=? AND name='swimlane_id' AND value='0'",
      [project.id as number],
    );

    for (const param of params) {
      await db.exec("UPDATE action_has_params SET value=? WHERE id=?", [
        swimlaneId,
        param.id as number,
      ]);
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
            timezone VARCHAR(50) DEFAULT 'UTC'
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE users (
            id INT NOT NULL AUTO_INCREMENT,
            username VARCHAR(50),
            password VARCHAR(255),
            is_admin TINYINT DEFAULT 0,
            default_project_id INT DEFAULT 0,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE projects (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(50) UNIQUE,
            is_active TINYINT DEFAULT 1,
            token VARCHAR(255),
            PRIMARY KEY (id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE project_has_users (
            id INT NOT NULL AUTO_INCREMENT,
            project_id INT,
            user_id INT,
            PRIMARY KEY (id),
            UNIQUE KEY \`idx_project_user\` (project_id, user_id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE columns (
            id INT NOT NULL AUTO_INCREMENT,
            title VARCHAR(255),
            position INT NOT NULL,
            project_id INT NOT NULL,
            task_limit INT DEFAULT '0',
            UNIQUE KEY \`idx_title_project\` (title, project_id),
            PRIMARY KEY (id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE tasks (
            id INT NOT NULL AUTO_INCREMENT,
            title VARCHAR(255),
            description TEXT,
            date_creation INT,
            date_completed INT,
            date_due INT,
            color_id VARCHAR(50),
            project_id INT,
            column_id INT,
            owner_id INT DEFAULT '0',
            position INT,
            score INT,
            is_active TINYINT DEFAULT 1,
            PRIMARY KEY (id),
            INDEX \`idx_task_active\` (is_active),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE comments (
            id INT NOT NULL AUTO_INCREMENT,
            task_id INT,
            user_id INT,
            \`date\` INT,
            comment TEXT,
            PRIMARY KEY (id),
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE actions (
            id INT NOT NULL AUTO_INCREMENT,
            project_id INT,
            event_name VARCHAR(50),
            action_name VARCHAR(50),
            PRIMARY KEY (id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE action_has_params (
            id INT NOT NULL AUTO_INCREMENT,
            action_id INT,
            name VARCHAR(50),
            value VARCHAR(50),
            PRIMARY KEY (id),
            FOREIGN KEY(action_id) REFERENCES actions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
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

  // version_12
  12: async (db) => {
    await db.exec(`
        CREATE TABLE remember_me (
            id INT NOT NULL AUTO_INCREMENT,
            user_id INT,
            ip VARCHAR(45),
            user_agent VARCHAR(255),
            token VARCHAR(255),
            sequence VARCHAR(255),
            expiration INT,
            date_creation INT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB CHARSET=utf8`);
    await db.exec(`
        CREATE TABLE last_logins (
            id INT NOT NULL AUTO_INCREMENT,
            auth_type VARCHAR(25),
            user_id INT,
            ip VARCHAR(45),
            user_agent VARCHAR(255),
            date_creation INT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (id),
            INDEX (user_id)
        ) ENGINE=InnoDB CHARSET=utf8`);
  },

  // version_13
  13: async (db) => {
    await db.exec(
      `ALTER TABLE users ADD COLUMN is_ldap_user TINYINT(1) DEFAULT 0`,
    );
  },

  // version_14
  14: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN name VARCHAR(255)`);
    await db.exec(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
    await db.exec(`ALTER TABLE users ADD COLUMN google_id VARCHAR(30)`);
  },

  // version_15
  15: async (db) => {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN last_modified INT DEFAULT 0`,
    );
  },

  // version_16
  16: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_categories (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(255),
            project_id INT,
            PRIMARY KEY (id),
            UNIQUE KEY \`idx_project_category\` (project_id, name),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN category_id INT DEFAULT 0`);
  },

  // version_17
  17: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_files (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(50),
            path VARCHAR(255),
            is_image TINYINT(1) DEFAULT 0,
            task_id INT,
            PRIMARY KEY (id),
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8`);
  },

  // version_18
  18: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_subtasks (
            id INT NOT NULL AUTO_INCREMENT,
            title VARCHAR(255),
            status INT DEFAULT 0,
            time_estimated INT DEFAULT 0,
            time_spent INT DEFAULT 0,
            task_id INT NOT NULL,
            user_id INT,
            PRIMARY KEY (id),
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8`);
  },

  // version_19
  19: async (db) => {
    await db.exec(
      `ALTER TABLE config ADD COLUMN api_token VARCHAR(255) DEFAULT ''`,
    );
    await db.exec(`UPDATE config SET api_token='${generateToken()}'`);
  },

  // version_20
  20: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN github_id VARCHAR(30)`);
  },

  // version_21
  21: async (db) => {
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN creator_id INTEGER DEFAULT '0'`,
    );
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN date_modification INTEGER DEFAULT '0'`,
    );
  },

  // version_22
  22: async (db) => {
    await db.exec(
      `ALTER TABLE config ADD COLUMN webhooks_url_task_modification VARCHAR(255)`,
    );
    await db.exec(
      `ALTER TABLE config ADD COLUMN webhooks_url_task_creation VARCHAR(255)`,
    );
  },

  // version_23
  23: async (db) => {
    await db.exec(
      `ALTER TABLE users ADD COLUMN notifications_enabled TINYINT(1) DEFAULT '0'`,
    );
    await db.exec(`
        CREATE TABLE user_has_notifications (
            user_id INT,
            project_id INT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, user_id)
        );
    `);
  },

  // version_24
  24: async (db) => {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN is_public TINYINT(1) DEFAULT '0'`,
    );
  },

  // version_25
  25: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_events (
            id INT NOT NULL AUTO_INCREMENT,
            date_creation INT NOT NULL,
            event_name TEXT NOT NULL,
            creator_id INT,
            project_id INT,
            task_id INT,
            data TEXT,
            FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE subtask_has_events (
            id INT NOT NULL AUTO_INCREMENT,
            date_creation INT NOT NULL,
            event_name TEXT NOT NULL,
            creator_id INT,
            project_id INT,
            subtask_id INT,
            task_id INT,
            data TEXT,
            FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(subtask_id) REFERENCES task_has_subtasks(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE comment_has_events (
            id INT NOT NULL AUTO_INCREMENT,
            date_creation INT NOT NULL,
            event_name TEXT NOT NULL,
            creator_id INT,
            project_id INT,
            comment_id INT,
            task_id INT,
            data TEXT,
            FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_26
  26: async (db) => {
    await db.exec(
      `ALTER TABLE config ADD COLUMN default_columns VARCHAR(255) DEFAULT ''`,
    );
  },

  // version_27
  27: async (db) => {
    await db.exec(`CREATE UNIQUE INDEX users_username_idx ON users(username)`);
  },

  // version_28
  28: async (db) => {
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN reference VARCHAR(50) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE comments ADD COLUMN reference VARCHAR(50) DEFAULT ''`,
    );
    await db.exec(`CREATE INDEX tasks_reference_idx ON tasks(reference)`);
    await db.exec(`CREATE INDEX comments_reference_idx ON comments(reference)`);
  },

  // version_29
  29: async (db) => {
    await db.exec(`
        CREATE TABLE settings (
            \`option\` VARCHAR(100) PRIMARY KEY,
            \`value\` VARCHAR(255) DEFAULT ''
        )
    `);
    // Migrate old config parameters
    // Migrate old config parameters
    const { rows } = await db.exec("SELECT * FROM config");
    const parameters = rows[0] ?? {};

    const insert = "INSERT INTO settings VALUES (?, ?)";
    await db.exec(insert, ["board_highlight_period", 48 * 60 * 60]);
    await db.exec(insert, ["board_public_refresh_interval", 60]);
    await db.exec(insert, ["board_private_refresh_interval", 10]);
    await db.exec(insert, [
      "board_columns",
      parameters.default_columns ?? null,
    ]);
    await db.exec(insert, [
      "webhook_url_task_creation",
      parameters.webhooks_url_task_creation ?? null,
    ]);
    await db.exec(insert, [
      "webhook_url_task_modification",
      parameters.webhooks_url_task_modification ?? null,
    ]);
    await db.exec(insert, ["webhook_token", parameters.webhooks_token ?? null]);
    await db.exec(insert, ["api_token", parameters.api_token ?? null]);
    await db.exec(insert, [
      "application_language",
      parameters.language ?? null,
    ]);
    await db.exec(insert, [
      "application_timezone",
      parameters.timezone ?? null,
    ]);
    await db.exec(insert, ["application_url", ""]);

    await db.exec("DROP TABLE config");
  },

  // version_30
  30: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "application_date_format",
      "m/d/Y",
    ]);
  },

  // version_31
  31: async (db) => {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN is_private TINYINT(1) DEFAULT '0'`,
    );
  },

  // version_32
  32: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_started INTEGER`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN time_spent FLOAT DEFAULT 0`);
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN time_estimated FLOAT DEFAULT 0`,
    );
    await db.exec(`ALTER TABLE task_has_subtasks MODIFY time_estimated FLOAT`);
    await db.exec(`ALTER TABLE task_has_subtasks MODIFY time_spent FLOAT`);
  },

  // version_33
  33: async (db) => {
    await db.exec(`
        CREATE TABLE project_activities (
            id INT NOT NULL AUTO_INCREMENT,
            date_creation INT NOT NULL,
            event_name VARCHAR(50) NOT NULL,
            creator_id INT,
            project_id INT,
            task_id INT,
            data TEXT,
            PRIMARY KEY(id),
            FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`DROP TABLE task_has_events`);
    await db.exec(`DROP TABLE comment_has_events`);
    await db.exec(`DROP TABLE subtask_has_events`);
  },

  // version_34
  34: async (db) => {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN is_everybody_allowed TINYINT(1) DEFAULT '0'`,
    );
  },

  // version_35
  35: async (db) => {
    await db.exec(`
        CREATE TABLE project_daily_summaries (
            id INT NOT NULL AUTO_INCREMENT,
            day CHAR(10) NOT NULL,
            project_id INT NOT NULL,
            column_id INT NOT NULL,
            total INT NOT NULL DEFAULT 0,
            PRIMARY KEY(id),
            FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(
      `CREATE UNIQUE INDEX project_daily_column_stats_idx ON project_daily_summaries(day, project_id, column_id)`,
    );
  },

  // version_36
  36: async (db) => {
    await db.exec(`ALTER TABLE tasks MODIFY title VARCHAR(255) NOT NULL`);
  },

  // version_37
  37: async (db) => {
    await db.exec(
      `ALTER TABLE project_has_users ADD COLUMN is_owner TINYINT(1) DEFAULT '0'`,
    );
  },

  // version_38
  38: async (db) => {
    await db.exec(`
        CREATE TABLE swimlanes (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(200) NOT NULL,
            position INT DEFAULT 1,
            is_active INT DEFAULT 1,
            project_id INT,
            PRIMARY KEY(id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (name, project_id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`ALTER TABLE tasks ADD COLUMN swimlane_id INT DEFAULT 0`);
    await db.exec(
      `ALTER TABLE projects ADD COLUMN default_swimlane VARCHAR(200) DEFAULT 'Default swimlane'`,
    );
    await db.exec(
      `ALTER TABLE projects ADD COLUMN show_default_swimlane INT DEFAULT 1`,
    );
  },

  // version_39
  39: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "project_categories",
      "",
    ]);
  },

  // version_40
  40: async (db) => {
    // Avoid some full table scans
    await db.exec(`CREATE INDEX users_admin_idx ON users(is_admin)`);
    await db.exec(`CREATE INDEX columns_project_idx ON columns(project_id)`);
    await db.exec(`CREATE INDEX tasks_project_idx ON tasks(project_id)`);
    await db.exec(
      `CREATE INDEX swimlanes_project_idx ON swimlanes(project_id)`,
    );
    await db.exec(
      `CREATE INDEX categories_project_idx ON project_has_categories(project_id)`,
    );
    await db.exec(
      `CREATE INDEX subtasks_task_idx ON task_has_subtasks(task_id)`,
    );
    await db.exec(`CREATE INDEX files_task_idx ON task_has_files(task_id)`);
    await db.exec(`CREATE INDEX comments_task_idx ON comments(task_id)`);
    // Set the ownership for all private projects
    const { rows: projects } = await db.exec(
      "SELECT id FROM projects WHERE is_private=1",
    );

    for (const project of projects) {
      await db.exec(
        "UPDATE project_has_users SET is_owner=1 WHERE project_id=?",
        [project.id as number],
      );
    }
  },

  // version_41
  41: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN timezone VARCHAR(50)`);
    await db.exec(`ALTER TABLE users ADD COLUMN language CHAR(5)`);
  },

  // version_42
  42: async (db) => {
    await db.exec(`ALTER TABLE columns ADD COLUMN description TEXT`);
  },

  // version_43
  43: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "subtask_restriction",
      "0",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "subtask_time_tracking",
      "0",
    ]);
    await db.exec(`
        CREATE TABLE subtask_time_tracking (
            id INT NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            subtask_id INT NOT NULL,
            start INT DEFAULT 0,
            end INT DEFAULT 0,
            PRIMARY KEY(id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(subtask_id) REFERENCES task_has_subtasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_44
  44: async (db) => {
    await db.exec(
      `ALTER TABLE users ADD COLUMN disable_login_form TINYINT(1) DEFAULT 0`,
    );
  },

  // version_45
  45: async (db) => {
    await db.exec(`ALTER TABLE tasks ADD COLUMN date_moved INT DEFAULT 0`);
    /* Update tasks.date_moved from project_activities table if tasks.date_moved = null or 0.
     * We take max project_activities.date_creation where event_name in task.create','task.move.column
     * since creation date is always less than task moves */
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
    await db.exec(
      `UPDATE tasks SET date_moved = date_creation WHERE date_moved IS NULL OR date_moved = 0`,
    );
  },

  // version_46
  46: async (db) => {
    await db.exec(`CREATE TABLE links (
        id INT NOT NULL AUTO_INCREMENT,
        label VARCHAR(255) NOT NULL,
        opposite_id INT DEFAULT 0,
        PRIMARY KEY(id),
        UNIQUE(label)
    ) ENGINE=InnoDB CHARSET=utf8`);
    await db.exec(`CREATE TABLE task_has_links (
        id INT NOT NULL AUTO_INCREMENT,
        link_id INT NOT NULL,
        task_id INT NOT NULL,
        opposite_task_id INT NOT NULL,
        FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE CASCADE,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(opposite_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY(id)
    ) ENGINE=InnoDB CHARSET=utf8`);
    await db.exec(
      `CREATE INDEX task_has_links_task_index ON task_has_links(task_id)`,
    );
    await db.exec(
      `CREATE UNIQUE INDEX task_has_links_unique ON task_has_links(link_id, task_id, opposite_task_id)`,
    );
    const insertLink = "INSERT INTO links (label, opposite_id) VALUES (?, ?)";

    // ID cannot be known at time of record creation so we have to update it after the fact
    // On MariaDB clusters auto-increment size is normally != 1, so relying on increments of 1 would break
    const updateLink = "UPDATE links SET opposite_id=? WHERE label=?";

    await db.exec(insertLink, ["relates to", 0]);

    const pairs: Array<[string, string]> = [
      ["blocks", "is blocked by"],
      ["duplicates", "is duplicated by"],
      ["is a parent of", "is a child of"],
      ["is a milestone of", "targets milestone"],
      ["is fixed by", "fixes"],
    ];

    for (const [label, opposite] of pairs) {
      const first = await db.exec(insertLink, [label, 0]);
      const second = await db.exec(insertLink, [
        opposite,
        first.insertId as number,
      ]);
      await db.exec(updateLink, [second.insertId as number, label]);
    }
  },

  // version_47
  47: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN description TEXT`);
  },

  // version_48
  48: async (db) => {
    await db.exec(`RENAME TABLE task_has_files TO files`);
    await db.exec(`RENAME TABLE task_has_subtasks TO subtasks`);
  },

  // version_49
  49: async (db) => {
    await db.exec(`ALTER TABLE subtasks ADD COLUMN position INTEGER DEFAULT 1`);
    let taskId: unknown = 0;
    let position = 1;

    const { rows: subtasks } = await db.exec(
      "SELECT * FROM subtasks ORDER BY task_id, id ASC",
    );

    for (const subtask of subtasks) {
      if (Number(taskId) !== Number(subtask.task_id)) {
        position = 1;
        taskId = subtask.task_id;
      }

      await db.exec("UPDATE subtasks SET position=? WHERE id=?", [
        position,
        subtask.id as number,
      ]);
      position++;
    }
  },

  // version_53
  53: async (db) => {
    await db.exec(
      `ALTER TABLE subtask_time_tracking ADD COLUMN time_spent FLOAT DEFAULT 0`,
    );
  },

  // version_54
  54: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "application_stylesheet",
      "",
    ]);
  },

  // version_55
  55: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "subtask_forecast",
      "0",
    ]);
  },

  // version_56
  56: async (db) => {
    await db.exec(`CREATE TABLE transitions (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`user_id\` INT NOT NULL,
        \`project_id\` INT NOT NULL,
        \`task_id\` INT NOT NULL,
        \`src_column_id\` INT NOT NULL,
        \`dst_column_id\` INT NOT NULL,
        \`date\` INT NOT NULL,
        \`time_spent\` INT DEFAULT 0,
        FOREIGN KEY(src_column_id) REFERENCES columns(id) ON DELETE CASCADE,
        FOREIGN KEY(dst_column_id) REFERENCES columns(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY(id)
    ) ENGINE=InnoDB CHARSET=utf8`);
    await db.exec(
      `CREATE INDEX transitions_task_index ON transitions(task_id)`,
    );
    await db.exec(
      `CREATE INDEX transitions_project_index ON transitions(project_id)`,
    );
    await db.exec(
      `CREATE INDEX transitions_user_index ON transitions(user_id)`,
    );
  },

  // version_57
  57: async (db) => {
    await db.exec(
      `CREATE TABLE currencies (\`currency\` CHAR(3) NOT NULL UNIQUE, \`rate\` FLOAT DEFAULT 0) ENGINE=InnoDB CHARSET=utf8`,
    );
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "application_currency",
      "USD",
    ]);
  },

  // version_58
  58: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_slack_webhook",
      "0",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_slack_webhook_url",
      "",
    ]);
  },

  // version_59
  59: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_hipchat",
      "0",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_hipchat_api_url",
      "https://api.hipchat.com",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_hipchat_room_id",
      "",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_hipchat_room_token",
      "",
    ]);
  },

  // version_60
  60: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_gravatar",
      "0",
    ]);
  },

  // version_61
  61: async (db) => {
    await db.exec(
      `ALTER TABLE users ADD COLUMN twofactor_activated TINYINT(1) DEFAULT 0`,
    );
    await db.exec(`ALTER TABLE users ADD COLUMN twofactor_secret CHAR(16)`);
  },

  // version_62
  62: async (db) => {
    await db.exec(
      `ALTER TABLE files ADD COLUMN \`date\` INT NOT NULL DEFAULT 0`,
    );
    await db.exec(
      `ALTER TABLE files ADD COLUMN \`user_id\` INT NOT NULL DEFAULT 0`,
    );
    await db.exec(
      `ALTER TABLE files ADD COLUMN \`size\` INT NOT NULL DEFAULT 0`,
    );
  },

  // version_63
  63: async (db) => {
    await db.exec(
      `ALTER TABLE project_has_categories ADD COLUMN description TEXT`,
    );
  },

  // version_64
  64: async (db) => {
    await db.exec(
      `ALTER TABLE project_daily_summaries ADD COLUMN score INT NOT NULL DEFAULT 0`,
    );
  },

  // version_65
  65: async (db) => {
    await db.exec(`
        CREATE TABLE project_integrations (
            \`id\` INT NOT NULL AUTO_INCREMENT,
            \`project_id\` INT NOT NULL UNIQUE,
            \`hipchat\` TINYINT(1) DEFAULT 0,
            \`hipchat_api_url\` VARCHAR(255) DEFAULT 'https://api.hipchat.com',
            \`hipchat_room_id\` VARCHAR(255),
            \`hipchat_room_token\` VARCHAR(255),
            \`slack\` TINYINT(1) DEFAULT 0,
            \`slack_webhook_url\` VARCHAR(255),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            PRIMARY KEY(id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_66
  66: async (db) => {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN identifier VARCHAR(50) DEFAULT ''`,
    );
  },

  // version_67
  67: async (db) => {
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN recurrence_status INTEGER NOT NULL DEFAULT 0`,
    );
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN recurrence_trigger INTEGER NOT NULL DEFAULT 0`,
    );
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN recurrence_factor INTEGER NOT NULL DEFAULT 0`,
    );
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN recurrence_timeframe INTEGER NOT NULL DEFAULT 0`,
    );
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN recurrence_basedate INTEGER NOT NULL DEFAULT 0`,
    );
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_parent INTEGER`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_child INTEGER`);
  },

  // version_68
  68: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_jabber",
      "0",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_jabber_server",
      "",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_jabber_domain",
      "",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_jabber_username",
      "",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_jabber_password",
      "",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_jabber_nickname",
      "kanboard",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "integration_jabber_room",
      "",
    ]);
    await db.exec(
      `ALTER TABLE project_integrations ADD COLUMN jabber INTEGER DEFAULT '0'`,
    );
    await db.exec(
      `ALTER TABLE project_integrations ADD COLUMN jabber_server VARCHAR(255) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE project_integrations ADD COLUMN jabber_domain VARCHAR(255) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE project_integrations ADD COLUMN jabber_username VARCHAR(255) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE project_integrations ADD COLUMN jabber_password VARCHAR(255) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE project_integrations ADD COLUMN jabber_nickname VARCHAR(255) DEFAULT 'kanboard'`,
    );
    await db.exec(
      `ALTER TABLE project_integrations ADD COLUMN jabber_room VARCHAR(255) DEFAULT ''`,
    );
  },

  // version_69
  69: async (db) => {
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "calendar_user_subtasks_time_tracking",
      0,
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "calendar_user_tasks",
      "date_started",
    ]);
    await db.exec(`INSERT INTO settings VALUES (?, ?)`, [
      "calendar_project_tasks",
      "date_started",
    ]);
    await db.exec(
      `DELETE FROM \`settings\` WHERE \`option\`='subtask_forecast'`,
    );
  },

  // version_70
  70: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN token VARCHAR(255) DEFAULT ''`);
  },

  // version_71
  71: async (db) => {
    await db.exec(`INSERT INTO \`settings\` VALUES (?, ?)`, [
      "webhook_url",
      "",
    ]);
    await db.exec(
      `DELETE FROM \`settings\` WHERE \`option\`='webhook_url_task_creation'`,
    );
    await db.exec(
      `DELETE FROM \`settings\` WHERE \`option\`='webhook_url_task_modification'`,
    );
  },

  // version_72
  72: async (db) => {
    await db.exec(`ALTER TABLE files MODIFY name VARCHAR(255)`);
  },

  // version_73
  73: async (db) => {
    await db.exec(
      `ALTER TABLE users ADD COLUMN notifications_filter INT DEFAULT 4`,
    );
  },

  // version_74
  74: async (db) => {
    await db.exec(
      `ALTER TABLE project_has_categories MODIFY project_id INT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE project_has_categories MODIFY name VARCHAR(255) NOT NULL`,
    );
    await db.exec(`ALTER TABLE actions MODIFY project_id INT NOT NULL`);
    await db.exec(`ALTER TABLE actions MODIFY event_name VARCHAR(50) NOT NULL`);
    await db.exec(
      `ALTER TABLE actions MODIFY action_name VARCHAR(50) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE action_has_params MODIFY action_id INT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE action_has_params MODIFY name VARCHAR(50) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE action_has_params MODIFY value VARCHAR(50) NOT NULL`,
    );
    await db.exec(`ALTER TABLE files MODIFY name VARCHAR(255) NOT NULL`);
    await db.exec(`ALTER TABLE files MODIFY task_id INT NOT NULL`);
    await db.exec(`ALTER TABLE subtasks MODIFY title VARCHAR(255) NOT NULL`);
    await db.exec(`ALTER TABLE tasks MODIFY project_id INT NOT NULL`);
    await db.exec(`ALTER TABLE tasks MODIFY column_id INT NOT NULL`);
    await db.exec(`ALTER TABLE columns MODIFY title VARCHAR(255) NOT NULL`);
    await db.exec(`ALTER TABLE columns MODIFY project_id INT NOT NULL`);
    await db.exec(
      `ALTER TABLE project_has_users MODIFY project_id INT NOT NULL`,
    );
    await db.exec(`ALTER TABLE project_has_users MODIFY user_id INT NOT NULL`);
    await db.exec(
      `ALTER TABLE projects MODIFY name VARCHAR(255) NOT NULL UNIQUE`,
    );
    await db.exec(`ALTER TABLE users MODIFY username VARCHAR(50) NOT NULL`);
    await db.exec(
      `ALTER TABLE user_has_notifications MODIFY project_id INT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE user_has_notifications MODIFY user_id INT NOT NULL`,
    );
  },

  // version_75
  75: async (db) => {
    await db.exec(`ALTER TABLE comments DROP FOREIGN KEY comments_ibfk_2`);
    await db.exec(`ALTER TABLE comments MODIFY task_id INT NOT NULL`);
    await db.exec(
      `ALTER TABLE comments CHANGE COLUMN \`user_id\` \`user_id\` INT DEFAULT 0`,
    );
    await db.exec(
      `ALTER TABLE comments CHANGE COLUMN \`date\` \`date_creation\` INT NOT NULL`,
    );
  },

  // version_76
  76: async (db) => {
    await db.exec(
      `DELETE FROM \`settings\` WHERE \`option\`='subtask_time_tracking'`,
    );
  },

  // version_77
  77: async (db) => {
    await db.exec(`ALTER TABLE users DROP COLUMN \`default_project_id\``);
  },

  // version_78
  78: async (db) => {
    await db.exec(
      `ALTER TABLE project_integrations ADD COLUMN slack_webhook_channel VARCHAR(255) DEFAULT ''`,
    );
    await db.exec(
      `INSERT INTO settings VALUES ('integration_slack_webhook_channel', '')`,
    );
  },

  // version_79
  79: async (db) => {
    await db.exec(`
        CREATE TABLE project_daily_stats (
            id INT NOT NULL AUTO_INCREMENT,
            day CHAR(10) NOT NULL,
            project_id INT NOT NULL,
            avg_lead_time INT NOT NULL DEFAULT 0,
            avg_cycle_time INT NOT NULL DEFAULT 0,
            PRIMARY KEY(id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(
      `CREATE UNIQUE INDEX project_daily_stats_idx ON project_daily_stats(day, project_id)`,
    );
    await db.exec(
      `RENAME TABLE project_daily_summaries TO project_daily_column_stats`,
    );
  },

  // version_80
  80: async (db) => {
    await db.exec(`INSERT INTO settings VALUES ('default_color', 'yellow')`);
  },

  // version_81
  81: async (db) => {
    await db.exec(`INSERT INTO settings VALUES ('subtask_time_tracking', '1')`);
    await db.exec(
      `INSERT INTO settings VALUES ('cfd_include_closed_tasks', '1')`,
    );
  },

  // version_82
  82: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN nb_failed_login INT DEFAULT 0`);
    await db.exec(
      `ALTER TABLE users ADD COLUMN lock_expiration_date INT DEFAULT 0`,
    );
  },

  // version_83
  83: async (db) => {
    await db.exec(
      `ALTER TABLE users ADD COLUMN is_project_admin INT DEFAULT 0`,
    );
  },

  // version_84
  84: async (db) => {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN start_date VARCHAR(10) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE projects ADD COLUMN end_date VARCHAR(10) DEFAULT ''`,
    );
  },

  // version_85
  85: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN gitlab_id INT`);
  },

  // version_86
  86: async (db) => {
    await db.exec(`ALTER TABLE swimlanes ADD COLUMN description TEXT`);
  },

  // version_87
  87: async (db) => {
    await db.exec(`
        CREATE TABLE plugin_schema_versions (
            plugin VARCHAR(80) NOT NULL,
            version INT NOT NULL DEFAULT 0,
            PRIMARY KEY(plugin)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_88
  88: async (db) => {
    await db.exec(`
        CREATE TABLE custom_filters (
            id INT NOT NULL AUTO_INCREMENT,
            filter VARCHAR(100) NOT NULL,
            project_id INT NOT NULL,
            user_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            is_shared TINYINT(1) DEFAULT 0,
            PRIMARY KEY(id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_89
  89: async (db) => {
    await db.exec(`
        CREATE TABLE user_has_unread_notifications (
            id INT NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            date_creation BIGINT NOT NULL,
            event_name VARCHAR(50) NOT NULL,
            event_data TEXT NOT NULL,
            PRIMARY KEY(id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE user_has_notification_types (
            id INT NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            notification_type VARCHAR(50),
            PRIMARY KEY(id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(
      `CREATE UNIQUE INDEX user_has_notification_types_user_idx ON user_has_notification_types(user_id, notification_type)`,
    );
    // Migrate people who have notification enabled before
    // Migrate people who have notification enabled before
    const { rows: users } = await db.exec(
      "SELECT id FROM users WHERE notifications_enabled=1",
    );

    for (const user of users) {
      await db.exec(
        "INSERT INTO user_has_notification_types (user_id, notification_type) VALUES (?, ?)",
        [user.id as number, "email"],
      );
    }
  },

  // version_90
  90: async (db) => {
    await db.exec(`ALTER TABLE tasks MODIFY date_due BIGINT`);
    await db.exec(`ALTER TABLE tasks MODIFY date_creation BIGINT`);
    await db.exec(`ALTER TABLE tasks MODIFY date_completed BIGINT`);
    await db.exec(`ALTER TABLE tasks MODIFY date_started BIGINT`);
    await db.exec(`ALTER TABLE tasks MODIFY date_moved BIGINT`);
    await db.exec(`ALTER TABLE comments MODIFY date_creation BIGINT`);
    await db.exec(`ALTER TABLE last_logins MODIFY date_creation BIGINT`);
    await db.exec(`ALTER TABLE project_activities MODIFY date_creation BIGINT`);
    await db.exec(`ALTER TABLE projects MODIFY last_modified BIGINT`);
    await db.exec(`ALTER TABLE remember_me MODIFY date_creation BIGINT`);
    await db.exec(`ALTER TABLE files MODIFY \`date\` BIGINT`);
    await db.exec(`ALTER TABLE transitions MODIFY \`date\` BIGINT`);
    await db.exec(`ALTER TABLE subtask_time_tracking MODIFY \`start\` BIGINT`);
    await db.exec(`ALTER TABLE subtask_time_tracking MODIFY \`end\` BIGINT`);
    await db.exec(`ALTER TABLE users MODIFY \`lock_expiration_date\` BIGINT`);
  },

  // version_91
  91: async (db) => {
    await db.exec(
      `ALTER TABLE custom_filters ADD COLUMN \`append\` TINYINT(1) DEFAULT 0`,
    );
  },

  // version_92
  92: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_notification_types (
            id INT NOT NULL AUTO_INCREMENT,
            project_id INT NOT NULL,
            notification_type VARCHAR(50) NOT NULL,
            PRIMARY KEY(id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, notification_type)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_93
  93: async (db) => {
    await db.exec(`
        CREATE TABLE user_has_metadata (
            user_id INT NOT NULL,
            name VARCHAR(50) NOT NULL,
            value VARCHAR(255) DEFAULT '',
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, name)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE project_has_metadata (
            project_id INT NOT NULL,
            name VARCHAR(50) NOT NULL,
            value VARCHAR(255) DEFAULT '',
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, name)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE task_has_metadata (
            task_id INT NOT NULL,
            name VARCHAR(50) NOT NULL,
            value VARCHAR(255) DEFAULT '',
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            UNIQUE(task_id, name)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`DROP TABLE project_integrations`);
    await db.exec(`DELETE FROM settings WHERE \`option\`='integration_jabber'`);
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_jabber_server'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_jabber_domain'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_jabber_username'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_jabber_password'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_jabber_nickname'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_jabber_room'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_hipchat'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_hipchat_api_url'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_hipchat_room_id'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_hipchat_room_token'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_slack_webhook'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_slack_webhook_url'`,
    );
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='integration_slack_webhook_channel'`,
    );
  },

  // version_94
  94: async (db) => {
    await db.exec(`ALTER TABLE \`projects\` DROP INDEX \`name\``);
    await db.exec(`ALTER TABLE \`projects\` DROP INDEX \`name_2\``);
  },

  // version_95
  95: async (db) => {
    await db.exec(`
        CREATE TABLE \`groups\` (
            id INT NOT NULL AUTO_INCREMENT,
            external_id VARCHAR(255) DEFAULT '',
            name VARCHAR(100) NOT NULL UNIQUE,
            PRIMARY KEY(id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE group_has_users (
            group_id INT NOT NULL,
            user_id INT NOT NULL,
            FOREIGN KEY(group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(group_id, user_id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_96
  96: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_groups (
            \`group_id\` INT NOT NULL,
            \`project_id\` INT NOT NULL,
            \`role\` VARCHAR(25) NOT NULL,
            FOREIGN KEY(group_id) REFERENCES \`groups\`(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(group_id, project_id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(
      `ALTER TABLE \`project_has_users\` ADD COLUMN \`role\` VARCHAR(25) NOT NULL DEFAULT '${ROLE.PROJECT_VIEWER}'`,
    );
    const { rows } = await db.exec("SELECT * FROM project_has_users");

    for (const row of rows) {
      await db.exec("UPDATE `project_has_users` SET `role`=? WHERE `id`=?", [
        Number(row.is_owner) === 1 ? ROLE.PROJECT_MANAGER : ROLE.PROJECT_MEMBER,
        row.id as number,
      ]);
    }

    await db.exec("ALTER TABLE `project_has_users` DROP COLUMN `is_owner`");
    await db.exec("ALTER TABLE `project_has_users` DROP COLUMN `id`");
  },

  // version_97
  97: async (db) => {
    await db.exec(
      `ALTER TABLE \`users\` ADD COLUMN \`role\` VARCHAR(25) NOT NULL DEFAULT '${ROLE.APP_USER}'`,
    );
    const { rows } = await db.exec("SELECT * FROM `users`");

    for (const row of rows) {
      let role: string = ROLE.APP_USER;

      if (Number(row.is_admin) === 1) {
        role = ROLE.APP_ADMIN;
      } else if (phpTruthy(row.is_project_admin)) {
        role = ROLE.APP_MANAGER;
      }

      await db.exec("UPDATE `users` SET `role`=? WHERE `id`=?", [
        role,
        row.id as number,
      ]);
    }

    await db.exec("ALTER TABLE `users` DROP COLUMN `is_admin`");
    await db.exec("ALTER TABLE `users` DROP COLUMN `is_project_admin`");
  },

  // version_98
  98: async (db) => {
    await db.exec(`ALTER TABLE \`users\` MODIFY \`language\` VARCHAR(5)`);
  },

  // version_99
  99: async (db) => {
    const { rows } = await db.exec("SELECT * FROM actions");

    for (const row of rows) {
      let actionName = String(row.action_name);

      if (
        actionName === "TaskAssignCurrentUser" &&
        row.event_name === "task.move.column"
      ) {
        actionName = "\\Kanboard\\Action\\TaskAssignCurrentUserColumn";
      } else if (
        actionName === "TaskClose" &&
        row.event_name === "task.move.column"
      ) {
        actionName = "\\Kanboard\\Action\\TaskCloseColumn";
      } else if (actionName === "TaskLogMoveAnotherColumn") {
        actionName = "\\Kanboard\\Action\\CommentCreationMoveTaskColumn";
      } else if (actionName[0] !== "\\") {
        actionName = `\\Kanboard\\Action\\${actionName}`;
      }

      await db.exec("UPDATE actions SET action_name=? WHERE id=?", [
        actionName,
        row.id as number,
      ]);
    }
  },

  // version_100
  100: async (db) => {
    await db.exec(
      `ALTER TABLE \`actions\` MODIFY \`action_name\` VARCHAR(255)`,
    );
  },

  // version_101
  101: async (db) => {
    await db.exec(`
        CREATE TABLE password_reset (
            token VARCHAR(80) PRIMARY KEY,
            user_id INT NOT NULL,
            date_expiration INT NOT NULL,
            date_creation INT NOT NULL,
            ip VARCHAR(45) NOT NULL,
            user_agent VARCHAR(255) NOT NULL,
            is_active TINYINT(1) NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`INSERT INTO settings VALUES ('password_reset', '1')`);
  },

  // version_102
  102: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN owner_id INT DEFAULT 0`);
  },

  // version_103
  103: async (db) => {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN priority_default INT DEFAULT 0`,
    );
    await db.exec(
      `ALTER TABLE projects ADD COLUMN priority_start INT DEFAULT 0`,
    );
    await db.exec(`ALTER TABLE projects ADD COLUMN priority_end INT DEFAULT 3`);
    await db.exec(`ALTER TABLE tasks ADD COLUMN priority INT DEFAULT 0`);
  },

  // version_104
  104: async (db) => {
    await db.exec(`
        CREATE TABLE task_has_external_links (
            id INT NOT NULL AUTO_INCREMENT,
            link_type VARCHAR(100) NOT NULL,
            dependency VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            url VARCHAR(255) NOT NULL,
            date_creation INT NOT NULL,
            date_modification INT NOT NULL,
            task_id INT NOT NULL,
            creator_id INT DEFAULT 0,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            PRIMARY KEY(id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_105
  105: async (db) => {
    await db.exec(
      `ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1`,
    );
  },

  // version_106
  106: async (db) => {
    await db.exec(`RENAME TABLE files TO task_has_files`);
    await db.exec(`
        CREATE TABLE project_has_files (
            \`id\` INT NOT NULL AUTO_INCREMENT,
            \`project_id\` INT NOT NULL,
            \`name\` VARCHAR(255) NOT NULL,
            \`path\` VARCHAR(255) NOT NULL,
            \`is_image\` TINYINT(1) DEFAULT 0,
            \`size\` INT DEFAULT 0 NOT NULL,
            \`user_id\` INT DEFAULT 0 NOT NULL,
            \`date\` INT DEFAULT 0 NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            PRIMARY KEY(id)
        )  ENGINE=InnoDB CHARSET=utf8`);
  },

  // version_107
  107: async (db) => {
    await db.exec(
      `UPDATE project_activities SET event_name='task.file.create' WHERE event_name='file.create'`,
    );
  },

  // version_108
  108: async (db) => {
    await db.exec(
      `ALTER TABLE user_has_metadata ADD COLUMN changed_by INT DEFAULT 0 NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE user_has_metadata ADD COLUMN changed_on INT DEFAULT 0 NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE project_has_metadata ADD COLUMN changed_by INT DEFAULT 0 NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE project_has_metadata ADD COLUMN changed_on INT DEFAULT 0 NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE task_has_metadata ADD COLUMN changed_by INT DEFAULT 0 NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE task_has_metadata ADD COLUMN changed_on INT DEFAULT 0 NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE settings ADD COLUMN changed_by INT DEFAULT 0 NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE settings ADD COLUMN changed_on INT DEFAULT 0 NOT NULL`,
    );
  },

  // version_109
  109: async (db) => {
    await db.exec(`ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255)`);
  },

  // version_110
  110: async (db) => {
    await db.exec(
      `ALTER TABLE user_has_notifications DROP FOREIGN KEY \`user_has_notifications_ibfk_1\``,
    );
    await db.exec(
      `ALTER TABLE user_has_notifications DROP FOREIGN KEY \`user_has_notifications_ibfk_2\``,
    );
    await db.exec(`DROP INDEX \`project_id\` ON user_has_notifications`);
    await db.exec(`ALTER TABLE user_has_notifications DROP KEY \`user_id\``);
    await db.exec(
      `CREATE UNIQUE INDEX \`user_has_notifications_unique_idx\` ON \`user_has_notifications\` (\`user_id\`, \`project_id\`)`,
    );
    await db.exec(
      `ALTER TABLE user_has_notifications ADD CONSTRAINT user_has_notifications_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
    );
    await db.exec(
      `ALTER TABLE user_has_notifications ADD CONSTRAINT user_has_notifications_ibfk_2 FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`,
    );
  },

  // version_111
  111: async (db) => {
    await db.exec(`
        CREATE TABLE tags (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            project_id INT NOT NULL,
            UNIQUE(project_id, name),
            PRIMARY KEY(id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE task_has_tags (
            task_id INT NOT NULL,
            tag_id INT NOT NULL,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE,
            UNIQUE(tag_id, task_id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_112
  112: async (db) => {
    await db.exec(
      `ALTER TABLE columns ADD COLUMN hide_in_dashboard INT DEFAULT 0 NOT NULL`,
    );
  },

  // version_113
  113: async (db) => {
    await db.exec(`
        CREATE TABLE project_has_roles (
            role_id INT NOT NULL AUTO_INCREMENT,
            \`role\` VARCHAR(255) NOT NULL,
            project_id INT NOT NULL,
            UNIQUE(project_id, \`role\`),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            PRIMARY KEY(role_id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(`
        CREATE TABLE column_has_move_restrictions (
            restriction_id INT NOT NULL AUTO_INCREMENT,
            project_id INT NOT NULL,
            role_id INT NOT NULL,
            src_column_id INT NOT NULL,
            dst_column_id INT NOT NULL,
            UNIQUE(role_id, src_column_id, dst_column_id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(role_id) REFERENCES project_has_roles(role_id) ON DELETE CASCADE,
            FOREIGN KEY(src_column_id) REFERENCES columns(id) ON DELETE CASCADE,
            FOREIGN KEY(dst_column_id) REFERENCES columns(id) ON DELETE CASCADE,
            PRIMARY KEY(restriction_id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(
      `ALTER TABLE \`project_has_users\` MODIFY \`role\` VARCHAR(255) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`project_has_groups\` MODIFY \`role\` VARCHAR(255) NOT NULL`,
    );
  },

  // version_114
  114: async (db) => {
    await db.exec(`
        CREATE TABLE project_role_has_restrictions (
            restriction_id INT NOT NULL AUTO_INCREMENT,
            project_id INT NOT NULL,
            role_id INT NOT NULL,
            rule VARCHAR(255) NOT NULL,
            UNIQUE(role_id, rule),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(role_id) REFERENCES project_has_roles(role_id) ON DELETE CASCADE,
            PRIMARY KEY(restriction_id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_115
  115: async (db) => {
    await db.exec(`
        CREATE TABLE column_has_restrictions (
            restriction_id INT NOT NULL AUTO_INCREMENT,
            project_id INT NOT NULL,
            role_id INT NOT NULL,
            column_id INT NOT NULL,
            rule VARCHAR(255) NOT NULL,
            UNIQUE(role_id, column_id, rule),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(role_id) REFERENCES project_has_roles(role_id) ON DELETE CASCADE,
            FOREIGN KEY(column_id) REFERENCES columns(id) ON DELETE CASCADE,
            PRIMARY KEY(restriction_id)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
  },

  // version_116
  116: async (db) => {
    await db.exec(
      `ALTER TABLE tasks ADD COLUMN external_provider VARCHAR(255)`,
    );
    await db.exec(`ALTER TABLE tasks ADD COLUMN external_uri VARCHAR(255)`);
  },

  // version_117
  117: async (db) => {
    await db.exec(`ALTER TABLE \`settings\` MODIFY \`value\` TEXT`);
  },

  // version_118
  118: async (db) => {
    await db.exec(
      `ALTER TABLE \`users\` ADD COLUMN \`api_access_token\` VARCHAR(255) DEFAULT NULL`,
    );
  },

  // version_119
  119: async (db) => {
    await db.exec(
      `ALTER TABLE \`comments\` ADD COLUMN \`date_modification\` BIGINT(20)`,
    );
    await db.exec(
      `UPDATE \`comments\` SET \`date_modification\` = \`date_creation\` WHERE \`date_modification\` IS NULL`,
    );
  },

  // version_120
  120: async (db) => {
    await db.exec(`
        CREATE TABLE invites (
            email VARCHAR(255) NOT NULL,
            project_id INTEGER NOT NULL,
            token VARCHAR(255) NOT NULL,
            PRIMARY KEY(email, token)
        ) ENGINE=InnoDB CHARSET=utf8
    `);
    await db.exec(
      `DELETE FROM settings WHERE \`option\`='application_datetime_format'`,
    );
  },

  // version_121
  121: async (db) => {
    await db.exec(`ALTER TABLE projects ADD COLUMN email VARCHAR(255)`);
  },

  // version_122
  122: async (db) => {
    await migrateDefaultSwimlane(db);

    await db.exec("ALTER TABLE `projects` DROP COLUMN `default_swimlane`");
    await db.exec("ALTER TABLE `projects` DROP COLUMN `show_default_swimlane`");
    await db.exec("ALTER TABLE `tasks` MODIFY `swimlane_id` INT(11) NOT NULL;");
    await db.exec(
      "ALTER TABLE tasks ADD CONSTRAINT tasks_swimlane_ibfk_1 FOREIGN KEY (swimlane_id) REFERENCES swimlanes(id) ON DELETE CASCADE",
    );
  },

  // version_123
  123: async (db) => {
    await db.exec(
      `ALTER TABLE column_has_move_restrictions ADD COLUMN only_assigned TINYINT(1) DEFAULT 0`,
    );
  },

  // version_124
  124: async (db) => {
    await db.exec(
      `ALTER TABLE projects ADD COLUMN predefined_email_subjects TEXT`,
    );
  },

  // version_125
  125: async (db) => {
    await db.exec(`ALTER TABLE projects DROP COLUMN is_everybody_allowed`);
  },

  // version_126
  126: async (db) => {
    await db.exec(`CREATE TABLE predefined_task_descriptions (
        id INT NOT NULL AUTO_INCREMENT,
        project_id INT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        PRIMARY KEY(id)
    ) ENGINE=InnoDB CHARSET=utf8`);
  },

  // version_127
  127: async (db) => {
    await db.exec(`CREATE TABLE sessions (
        id VARCHAR(255) NOT NULL,
        expire_at INT NOT NULL,
        data LONGTEXT,
        PRIMARY KEY(id)
    ) ENGINE=InnoDB CHARSET=utf8`);
  },

  // version_128
  128: async (db) => {
    await db.exec(
      `ALTER TABLE \`users\` ADD COLUMN \`filter\` VARCHAR(255) DEFAULT NULL`,
    );
  },

  // version_129
  129: async (db) => {
    await db.exec(`ALTER TABLE \`projects\` MODIFY \`name\` TEXT NOT NULL`);
    await db.exec(`ALTER TABLE \`projects\` MODIFY \`email\` TEXT`);
    await db.exec(
      `ALTER TABLE \`action_has_params\` MODIFY \`name\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`action_has_params\` MODIFY \`value\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`actions\` MODIFY \`event_name\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`actions\` MODIFY \`action_name\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`comments\` MODIFY \`reference\` VARCHAR(255) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE \`custom_filters\` MODIFY \`filter\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`custom_filters\` MODIFY \`name\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`groups\` MODIFY \`name\` VARCHAR(255) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`project_activities\` MODIFY \`event_name\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`project_has_files\` MODIFY \`name\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`project_has_files\` MODIFY \`path\` TEXT NOT NULL`,
    );
    await db.exec(`ALTER TABLE \`subtasks\` MODIFY \`title\` TEXT NOT NULL`);
    await db.exec(
      `ALTER TABLE \`swimlanes\` MODIFY \`name\` VARCHAR(255) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`task_has_external_links\` MODIFY \`title\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`task_has_external_links\` MODIFY \`url\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`task_has_files\` MODIFY \`name\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`task_has_files\` MODIFY \`path\` TEXT NOT NULL`,
    );
    await db.exec(`ALTER TABLE \`tasks\` MODIFY \`title\` TEXT NOT NULL`);
    await db.exec(
      `ALTER TABLE \`tasks\` MODIFY \`reference\` VARCHAR(255) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE \`user_has_unread_notifications\` MODIFY \`event_name\` TEXT NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`users\` MODIFY \`username\` VARCHAR(255) NOT NULL`,
    );
    await db.exec(`ALTER TABLE \`users\` MODIFY \`filter\` TEXT`);
  },

  // /*
  //
  // This migration convert table encoding to utf8mb4.
  // You should also convert the database encoding:
  //
  // ALTER DATABASE kanboard CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
  //
  // You might need to run:
  //
  // REPAIR TABLE table_name;
  // OPTIMIZE TABLE table_name;
  //
  // The max length for Mysql 5.6 is 191 for varchar unique keys in utf8mb4
  //
  // */
  // version_130
  130: async (db) => {
    await db.exec(
      `ALTER TABLE \`swimlanes\` MODIFY \`name\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`users\` MODIFY \`username\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`groups\` MODIFY \`name\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`links\` MODIFY \`label\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(`ALTER TABLE \`tags\` MODIFY \`name\` VARCHAR(191) NOT NULL`);
    await db.exec(
      `ALTER TABLE \`sessions\` MODIFY \`id\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`project_role_has_restrictions\` MODIFY \`rule\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`project_has_roles\` MODIFY \`role\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`project_has_categories\` MODIFY \`name\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`invites\` MODIFY \`email\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`invites\` MODIFY \`token\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`groups\` MODIFY \`name\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`columns\` MODIFY \`title\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`column_has_restrictions\` MODIFY \`rule\` VARCHAR(191) NOT NULL`,
    );
    await db.exec(
      `ALTER TABLE \`comments\` MODIFY \`reference\` VARCHAR(191) DEFAULT ''`,
    );
    await db.exec(
      `ALTER TABLE \`tasks\` MODIFY \`reference\` VARCHAR(191) DEFAULT ''`,
    );
    const tables = [
      "action_has_params",
      "actions",
      "column_has_move_restrictions",
      "column_has_restrictions",
      "columns",
      "comments",
      "currencies",
      "custom_filters",
      "group_has_users",
      "groups",
      "invites",
      "last_logins",
      "links",
      "password_reset",
      "plugin_schema_versions",
      "predefined_task_descriptions",
      "project_activities",
      "project_daily_column_stats",
      "project_daily_stats",
      "project_has_categories",
      "project_has_files",
      "project_has_groups",
      "project_has_metadata",
      "project_has_notification_types",
      "project_has_roles",
      "project_has_users",
      "project_role_has_restrictions",
      "projects",
      "remember_me",
      "sessions",
      "settings",
      "subtask_time_tracking",
      "subtasks",
      "swimlanes",
      "tags",
      "task_has_external_links",
      "task_has_files",
      "task_has_links",
      "task_has_metadata",
      "task_has_tags",
      "tasks",
      "transitions",
      "user_has_metadata",
      "user_has_notification_types",
      "user_has_notifications",
      "user_has_unread_notifications",
      "users",
    ];

    for (const table of tables) {
      await db.exec(
        `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    }
  },

  // version_131
  131: async (db) => {
    await db.exec(
      `ALTER TABLE \`users\` MODIFY \`language\` VARCHAR(11) DEFAULT NULL`,
    );
  },

  // version_132
  132: async (db) => {
    await db.exec(
      `ALTER TABLE \`project_has_categories\` ADD COLUMN \`color_id\` VARCHAR(50) DEFAULT NULL`,
    );
  },

  // version_133
  133: async (db) => {
    await db.exec(
      `ALTER TABLE \`tags\` ADD COLUMN \`color_id\` VARCHAR(50) DEFAULT NULL`,
    );
  },

  // version_134
  134: async (db) => {
    await db.exec(
      `ALTER TABLE \`projects\` ADD COLUMN \`per_swimlane_task_limits\` INT DEFAULT 0 NOT NULL`,
    );
  },

  // version_135
  135: async (db) => {
    await db.exec(
      `ALTER TABLE \`projects\` ADD COLUMN \`task_limit\` INT DEFAULT 0`,
    );
  },

  // version_136
  136: async (db) => {
    await db.exec(
      `ALTER TABLE \`swimlanes\` ADD COLUMN \`task_limit\` INT DEFAULT 0`,
    );
  },

  // version_137
  137: async (db) => {
    await db.exec(
      `ALTER TABLE \`projects\` ADD COLUMN \`enable_global_tags\` TINYINT(1) DEFAULT 1 NOT NULL`,
    );
  },

  // version_138
  138: async (db) => {
    await db.exec(
      `ALTER TABLE users ADD COLUMN theme VARCHAR(50) DEFAULT 'light' NOT NULL`,
    );
  },

  // version_139
  139: async (db) => {
    await db.exec(
      `ALTER TABLE \`comments\` ADD COLUMN \`visibility\` VARCHAR(25) NOT NULL DEFAULT '${ROLE.APP_USER}'`,
    );
  },
};

export const mysqlSchema: SchemaDefinition = {
  driver: "mysql",
  latestVersion: MYSQL_SCHEMA_VERSION,
  migrations,
};

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Database } from "../../../src/db/database.js";
import {
  MYSQL_SCHEMA_VERSION,
  mysqlSchema,
} from "../../../src/db/schema/mysql.js";

type Row = Record<string, unknown>;
type Responder = (sql: string, params: unknown[]) => Row[] | undefined;

/** Fake Database recording every statement; `respond` supplies rows for SELECTs. */
function fakeDb(respond: Responder = () => undefined) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let nextId = 100;
  const db = {
    exec: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql: sql.trim(), params });
      const rows = respond(sql, params) ?? [];
      const insertId = /^\s*INSERT/i.test(sql) ? nextId++ : undefined;
      return { rows, insertId, affectedRows: 0 };
    },
  } as unknown as Database;
  return { db, calls };
}

const phpSource = readFileSync(
  resolve(__dirname, "../../../app/Schema/Mysql.php"),
  "utf8",
);
const phpVersions = [
  ...phpSource.matchAll(/^function version_(\d+)\(PDO \$pdo\)/gm),
].map((m) => Number(m[1]));

describe("mysqlSchema", () => {
  it("declares the mysql driver and latest version 139", () => {
    expect(mysqlSchema.driver).toBe("mysql");
    expect(mysqlSchema.latestVersion).toBe(139);
    expect(MYSQL_SCHEMA_VERSION).toBe(139);
  });

  it("has exactly one migration per version function of the PHP schema", () => {
    expect(phpVersions.length).toBe(126);
    expect(
      Object.keys(mysqlSchema.migrations)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([...phpVersions].sort((a, b) => a - b));
    for (const v of phpVersions) {
      expect(typeof mysqlSchema.migrations[v]).toBe("function");
    }
  });

  it("runs every migration without throwing against an empty fake database", async () => {
    for (const v of phpVersions) {
      const { db, calls } = fakeDb();
      await mysqlSchema.migrations[v]!(db);
      expect(calls.length).toBeGreaterThan(0);
    }
  });

  it("version 1 seeds the admin user and a webhook token", async () => {
    const { db, calls } = fakeDb();
    await mysqlSchema.migrations[1]!(db);
    expect(calls.some((c) => c.sql.includes("VALUES ('admin', '$2y$10$"))).toBe(
      true,
    );
    expect(calls.at(-1)!.sql).toMatch(
      /INSERT INTO config\s+\(webhooks_token\)\s+VALUES \('[0-9a-f]{60}'\)/,
    );
  });

  it("version 139 uses the app-user role", async () => {
    const { db, calls } = fakeDb();
    await mysqlSchema.migrations[139]!(db);
    expect(calls[0]!.sql).toContain("DEFAULT 'app-user'");
  });

  it("version 130 converts every table to utf8mb4", async () => {
    const { db, calls } = fakeDb();
    await mysqlSchema.migrations[130]!(db);
    const converts = calls.filter((c) =>
      c.sql.includes("CONVERT TO CHARACTER SET utf8mb4"),
    );
    expect(converts.length).toBe(47);
    expect(converts[0]!.sql).toBe(
      "ALTER TABLE `action_has_params` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
  });

  it("version 97 maps is_admin/is_project_admin to roles", async () => {
    const { db, calls } = fakeDb((sql) =>
      sql.startsWith("SELECT * FROM `users`")
        ? [
            { id: 1, is_admin: 1, is_project_admin: 0 },
            { id: 2, is_admin: 0, is_project_admin: "1" },
            { id: 3, is_admin: 0, is_project_admin: 0 },
          ]
        : undefined,
    );
    await mysqlSchema.migrations[97]!(db);
    const updates = calls
      .filter((c) => c.sql.startsWith("UPDATE `users`"))
      .map((c) => c.params);
    expect(updates).toEqual([
      ["app-admin", 1],
      ["app-manager", 2],
      ["app-user", 3],
    ]);
  });

  it("version 96 maps is_owner to project roles", async () => {
    const { db, calls } = fakeDb((sql) =>
      sql.startsWith("SELECT * FROM project_has_users")
        ? [
            { id: 1, is_owner: 1 },
            { id: 2, is_owner: 0 },
          ]
        : undefined,
    );
    await mysqlSchema.migrations[96]!(db);
    expect(
      calls
        .filter((c) => c.sql.startsWith("UPDATE `project_has_users`"))
        .map((c) => c.params),
    ).toEqual([
      ["project-manager", 1],
      ["project-member", 2],
    ]);
  });

  it("version 99 namespaces action names", async () => {
    const { db, calls } = fakeDb((sql) =>
      sql === "SELECT * FROM actions"
        ? [
            {
              id: 1,
              action_name: "TaskAssignCurrentUser",
              event_name: "task.move.column",
            },
            { id: 2, action_name: "TaskClose", event_name: "task.move.column" },
            { id: 3, action_name: "TaskLogMoveAnotherColumn", event_name: "x" },
            { id: 4, action_name: "TaskCreation", event_name: "x" },
            {
              id: 5,
              action_name: "\\Kanboard\\Action\\Already",
              event_name: "x",
            },
          ]
        : undefined,
    );
    await mysqlSchema.migrations[99]!(db);
    expect(
      calls
        .filter((c) => c.sql.startsWith("UPDATE actions"))
        .map((c) => c.params),
    ).toEqual([
      ["\\Kanboard\\Action\\TaskAssignCurrentUserColumn", 1],
      ["\\Kanboard\\Action\\TaskCloseColumn", 2],
      ["\\Kanboard\\Action\\CommentCreationMoveTaskColumn", 3],
      ["\\Kanboard\\Action\\TaskCreation", 4],
      ["\\Kanboard\\Action\\Already", 5],
    ]);
  });

  it("version 122 migrates default swimlanes using insert ids", async () => {
    const { db, calls } = fakeDb((sql) =>
      sql === "SELECT * FROM projects"
        ? [{ id: 7, default_swimlane: "", show_default_swimlane: 1 }]
        : undefined,
    );
    await mysqlSchema.migrations[122]!(db);
    const insert = calls.find((c) =>
      c.sql.startsWith("INSERT INTO swimlanes"),
    )!;
    expect(insert.params).toEqual([7, "Default swimlane", 1, 1]);
    expect(
      calls.find((c) => c.sql.startsWith("UPDATE tasks SET swimlane_id=?"))!
        .params,
    ).toEqual([100, 7]);
    expect(
      calls.some((c) => c.sql.includes("DROP COLUMN `show_default_swimlane`")),
    ).toBe(true);
  });

  it("version 46 links opposite ids via insert ids", async () => {
    const { db, calls } = fakeDb();
    await mysqlSchema.migrations[46]!(db);
    const updates = calls
      .filter((c) => c.sql.startsWith("UPDATE links"))
      .map((c) => c.params);
    expect(updates).toEqual([
      [102, "blocks"],
      [104, "duplicates"],
      [106, "is a parent of"],
      [108, "is a milestone of"],
      [110, "is fixed by"],
    ]);
  });

  it("version 49 renumbers subtask positions per task", async () => {
    const { db, calls } = fakeDb((sql) =>
      sql.startsWith("SELECT * FROM subtasks")
        ? [
            { id: 1, task_id: 5 },
            { id: 2, task_id: 5 },
            { id: 3, task_id: 6 },
          ]
        : undefined,
    );
    await mysqlSchema.migrations[49]!(db);
    expect(
      calls
        .filter((c) => c.sql.startsWith("UPDATE subtasks"))
        .map((c) => c.params),
    ).toEqual([
      [1, 1],
      [2, 2],
      [1, 3],
    ]);
  });
});

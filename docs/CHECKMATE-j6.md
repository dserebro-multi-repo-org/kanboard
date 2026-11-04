# Kanboard Project Layout

A short overview of the top-level directories of this repository.

## `app/`
The application source. It holds the models, controllers, JSON-RPC API
procedures, automation actions, notifications, helpers, core services, database
schemas, locale files and the server-rendered templates.

## `assets/`
Static front-end files served to the browser: CSS, JavaScript, fonts, images
and vendored third-party front-end libraries.

## `plugins/`
The install location for third-party plugins. Each plugin lives in its own
subdirectory and extends Kanboard through the plugin hook system. It is empty
by default.

## `tests/`
The automated test suites: unit tests (`tests/units`), JSON-RPC integration
tests (`tests/integration`), and the per-database configuration files used to
run them against SQLite, MySQL and PostgreSQL.

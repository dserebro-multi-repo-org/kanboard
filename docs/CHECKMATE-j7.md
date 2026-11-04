# Kanboard Project Layout

A short overview of the top-level directories in this repository.

## `app/`
The application source code: controllers, models, core services
(dependency injection, routing, helpers), templates, API procedures,
console commands, locales, and the database schema migrations.

## `assets/`
Static front-end resources served to the browser: CSS, JavaScript, fonts,
images, and bundled third-party vendor files.

## `plugins/`
The install location for Kanboard plugins. Each plugin lives in its own
subdirectory and extends the application through hooks, events, and
template overrides. The directory is empty by default.

## `tests/`
The automated test suites: `units/` holds unit tests, `integration/` holds
integration tests against the API and databases, and the `*.xml` files
are the per-database test configurations.

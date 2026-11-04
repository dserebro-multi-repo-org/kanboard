# Top-Level Config Files

- `composer.json` / `composer.lock`: PHP dependencies and autoload rules.
- `config.default.php`: default settings; override them in a `config.php` file.
- `Dockerfile` and `docker-compose.*.yml`: container image and the SQLite, MySQL, and PostgreSQL setups.
- `Makefile`: shortcuts for building archives, running tests, and Docker tasks.
- `.htaccess` / `web.config`: URL rewriting and access rules for Apache and IIS.
- `.php-cs-fixer.php`: code style rules for the PHP CS Fixer tool.
- `.gitignore`, `.gitattributes`, `.dockerignore`: Git and Docker file handling.

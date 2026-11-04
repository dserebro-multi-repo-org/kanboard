<?php
// Creates a SQLite database with the original PHP schema (app/Schema/Sqlite.php) and prints its
// sqlite_master content as JSON. Usage: php php-schema-dump.php <repo-root>
$root = $argv[1];
require $root.'/vendor/autoload.php';
require $root.'/app/Schema/Sqlite.php';

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('PRAGMA foreign_keys = OFF');

for ($i = 1; $i <= \Schema\VERSION; $i++) {
    $function = '\Schema\version_'.$i;
    if (function_exists($function)) {
        $pdo->beginTransaction();
        call_user_func($function, $pdo);
        $pdo->commit();
    }
}

$out = array('version' => \Schema\VERSION, 'tables' => array());
foreach ($pdo->query("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name") as $t) {
    $name = $t['name'];
    $cols = $pdo->query('PRAGMA table_info("'.$name.'")')->fetchAll(PDO::FETCH_ASSOC);
    $fks = $pdo->query('PRAGMA foreign_key_list("'.$name.'")')->fetchAll(PDO::FETCH_ASSOC);
    $idx = array();
    foreach ($pdo->query('PRAGMA index_list("'.$name.'")')->fetchAll(PDO::FETCH_ASSOC) as $i) {
        $i['columns'] = array_map(function ($c) { return $c['name']; }, $pdo->query('PRAGMA index_info("'.$i['name'].'")')->fetchAll(PDO::FETCH_ASSOC));
        $idx[] = $i;
    }
    $out['tables'][$name] = array('columns' => $cols, 'foreign_keys' => $fks, 'indexes' => $idx);
}
echo json_encode($out);

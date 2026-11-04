<?php
/**
 * Generates golden HTML fixtures by rendering the ORIGINAL PHP templates with the real Kanboard stack
 * (sqlite database in a temp file). Usage:
 *   php tests/unit/views/gen-php-golden.php tests/unit/views/<dir>/cases.json tests/unit/views/<dir>/fixtures
 * cases.json: [{"name": "...", "template": "event/task_close", "vars": {...}, "router": ["ExportController","tasks"]?}]
 */
$root = dirname(__DIR__, 3);
$db = tempnam(sys_get_temp_dir(), 'kbgold');
define('DB_DRIVER', 'sqlite');
define('DB_FILENAME', $db);
define('DEBUG', false);
chdir($root);
require $root.'/app/common.php';

$cases = json_decode(file_get_contents($argv[1]), true);
$out = rtrim($argv[2], '/');
@mkdir($out, 0777, true);

foreach ($cases as $case) {
    if (isset($case['router'])) {
        $ref = new ReflectionClass($container['router']);
        foreach (array('currentControllerName' => 0, 'currentActionName' => 1) as $prop => $i) {
            $p = $ref->getProperty($prop);
            $p->setAccessible(true);
            $p->setValue($container['router'], $case['router'][$i]);
        }
    }
    $html = $container['template']->render($case['template'], $case['vars']);
    file_put_contents($out.'/'.$case['name'].'.html', $html);
}
@unlink($db);

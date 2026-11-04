<?php
/**
 * Generates the golden HTML fixtures of tests/unit/views/{notification,analytic}/cases.json by rendering the
 * ORIGINAL PHP templates (app/Template) with the real Kanboard container.
 *
 * Usage: php tests/unit/views/gen-notification-analytic.php <dir> <case-name>
 * (one process per case: the container is not re-entrant). Output: the rendered HTML on stdout.
 * Regenerate everything with tests/unit/views/regen-notification-analytic.sh.
 */
$dir = $argv[1];
$name = $argv[2];
$root = realpath(__DIR__.'/../../..');
$cases = json_decode(file_get_contents(__DIR__.'/'.$dir.'/cases.json'), true);
$case = null;
foreach ($cases as $c) {
    if ($c['name'] === $name) {
        $case = $c;
    }
}
if ($case === null) {
    fwrite(STDERR, "unknown case $name\n");
    exit(1);
}

$tmp = sys_get_temp_dir().'/kb-golden-'.getmypid();
@mkdir($tmp);
putenv('DB_FILENAME='.$tmp.'/db.sqlite');
putenv('PLUGINS_DIR='.__DIR__.'/_plugins');
chdir($root);

if (! empty($case['router'])) {
    $_GET['controller'] = $case['router']['controller'];
    $_GET['action'] = $case['router']['action'];
}

require $root.'/app/common.php';
date_default_timezone_set('UTC');

if (isset($case['config'])) {
    $container['configModel']->save($case['config']);
}
if (! empty($case['router'])) {
    $container['router']->dispatch();
}

$vars = $case['vars'] ?? array();

if (isset($case['paginator'])) {
    $p = $case['paginator'];
    $paginator = new Kanboard\Core\Paginator($container);
    $paginator->setUrl($p['controller'], $p['action'], $p['params']);
    $paginator->setCollection($p['collection'])->setTotal(count($p['collection']))->setMax($p['max'])
        ->setOrder($p['order'])->setDirection($p['direction'])->setPage($p['page']);
    if (empty($p['collection'])) {
        $paginator->setCollection(array())->setTotal(0);
    }
    $vars['paginator'] = $paginator;
}

if (isset($case['project_header_html'])) {
    $container['helper']->projectHeader = new class($case['project_header_html']) {
        private $html;
        public function __construct($html) { $this->html = $html; }
        public function render() { return $this->html; }
    };
}

if (isset($case['override'])) {
    foreach ($case['override'] as $from => $to) {
        $container['template']->setTemplateOverride($from, $to);
    }
}

echo $container['template']->render($case['template'], $vars);
@unlink($tmp.'/db.sqlite');
@rmdir($tmp);

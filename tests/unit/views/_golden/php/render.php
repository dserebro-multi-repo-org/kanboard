<?php
/**
 * Golden fixture generator: renders the ORIGINAL PHP templates (app/Template) with the real Kanboard container and
 * writes the HTML expected by the Nunjucks ports.
 *
 * Usage: php tests/unit/views/_golden/php/render.php [scenario-file.json ...]   (default: tests/unit/views/_golden/scenarios/*.json)
 *
 * Scenario: { name, template, vars, state?: { route: [controller, action], user: {...}|null, config: {...},
 *   hooks: [{hook, template}], sidebar/... }, fixture }  -- see tests/unit/views/_golden/env.ts for the TS counterpart.
 * Special values in `vars`: {"$paginator": {collection, total, html}} is replaced by a fake paginator.
 */
$root = realpath(__DIR__.'/../../../../..');
chdir($root);

define('DB_DRIVER', 'sqlite');
define('DB_FILENAME', ':memory:');
define('PLUGINS_DIR', realpath(__DIR__.'/../stubs'));
define('DISABLE_LOGOUT', false);
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['SERVER_PORT'] = 80;
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';

class FakePaginator
{
    public function __construct(private array $d) {}
    public function isEmpty() { return empty($this->d['collection']); }
    public function getCollection() { return $this->d['collection']; }
    public function getTotal() { return $this->d['total']; }
    public function order($label, $column) { return '<a href="#order-'.$column.'">'.$label.'</a>'; }
    public function __toString() { return $this->d['html'] ?? ''; }
}

function convert($v)
{
    if (is_array($v)) {
        if (count($v) === 1 && isset($v['$paginator'])) {
            return new FakePaginator(['collection' => convert($v['$paginator']['collection'] ?? []), 'total' => $v['$paginator']['total'] ?? 0, 'html' => $v['$paginator']['html'] ?? '']);
        }
        return array_map('convert', $v);
    }
    return $v;
}

$files = array_slice($argv, 1);
if (! $files) {
    $files = glob(__DIR__.'/../scenarios/*.json');
}

require $root.'/app/common.php';
/** @var Pimple\Container $container */

$stubs = json_decode(file_get_contents(__DIR__.'/../stubs/overrides.json'), true);
foreach ($stubs as $name) {
    $container['template']->setTemplateOverride($name, 'stub:'.$name);
}

$touched = array();
foreach ($files as $file) {
    foreach (json_decode(file_get_contents($file), true) as $s) {
        $state = $s['state'] ?? [];
        $user = array_key_exists('user', $state) ? $state['user'] : array('id' => 1, 'username' => 'admin', 'name' => '', 'role' => 'app-admin', 'email' => '', 'avatar_path' => '');
        if ($user === null) {
            unset($_SESSION['user']);
        } else {
            $_SESSION['user'] = array_merge(array('language' => '', 'timezone' => '', 'theme' => 'dark'), $user);
        }

        $route = $state['route'] ?? array('', '');
        $ref = new ReflectionClass($container['router']);
        foreach (array('currentControllerName' => $route[0], 'currentActionName' => $route[1]) as $p => $val) {
            $prop = $ref->getProperty($p);
            $prop->setAccessible(true);
            $prop->setValue($container['router'], $val);
        }

        foreach ($touched as $k) {
            $container['db']->table('settings')->eq('option', $k)->remove();
        }
        $touched = array();
        foreach (($state['config'] ?? array()) as $k => $val) {
            $container['configModel']->save(array($k => $val));
            $touched[] = $k;
        }
        $container['memoryCache']->flush();

        $container['db']->table('user_has_unread_notifications')->remove();
        if (! empty($state['notifications'])) {
            $container['db']->table('user_has_unread_notifications')->insert(array('user_id' => 1, 'date_creation' => 1, 'event_name' => 'task.create', 'event_data' => '{}'));
        }

        $container['db']->table('user_has_metadata')->remove();
        foreach (($state['collapsed'] ?? array()) as $pid) {
            $container['db']->table('user_has_metadata')->insert(array('user_id' => 1, 'name' => 'board.collapsed.'.$pid, 'value' => 1));
        }
        $container['memoryCache']->flush();

        // detach all hooks then attach the scenario ones
        $hp = new ReflectionProperty(Kanboard\Core\Plugin\Hook::class, 'hooks');
        $hp->setAccessible(true);
        $hp->setValue($container['hook'], array());
        foreach (($state['hooks'] ?? array()) as $h) {
            $container['helper']->hook->attach($h['hook'], $h['template']);
        }

        $html = $container['template']->render($s['template'], convert($s['vars'] ?? array()));
        foreach (($s['replace'] ?? array()) as $pattern => $replacement) {
            $html = preg_replace($pattern, $replacement, $html);
        }
        if (! empty($s['replace_first_style'])) {
            // the task color CSS of ColorModel is replaced by a marker (the TS side uses a fake color model)
            $html = preg_replace('#<style>.*?</style>#s', '<style>/*colors*/</style>', $html, 1);
        }
        foreach (($s['replace_strong'] ?? array()) as $label => $value) {
            $html = preg_replace('#('.preg_quote($label, '#').'\s*<strong>)[^<]*(</strong>)#', '${1}'.$value.'${2}', $html);
        }
        if (! empty($s['freeze_date'])) {
            $html = str_replace(array(date('Y-m-d'), date('Y_m_d')), array($s['freeze_date'], str_replace('-', '_', $s['freeze_date'])), $html);
        }
        $out = __DIR__.'/../fixtures/'.$s['fixture'];
        @mkdir(dirname($out), 0777, true);
        file_put_contents($out, $html);
        echo "wrote ".$s['fixture']."\n";
    }
}

<?php
// Generates expected.json by rendering inputs.json with the original PHP implementation (Parsedown + Kanboard\Core\Markdown).
// Usage: php tests/fixtures/markdown/generate.php > tests/fixtures/markdown/expected.json   (run from the repo root)
require __DIR__.'/../../../vendor/autoload.php';

use Kanboard\Core\Markdown;
use Pimple\Container;

$url = new class {
    public function to($controller, $action, array $params = array(), $anchor = '', $absolute = false)
    {
        $q = '?controller='.$controller.'&action='.$action;
        foreach ($params as $k => $v) {
            $q .= '&'.$k.'='.$v;
        }
        return ($absolute ? 'http://localhost/' : '').$q;
    }
};
$users = array(
    'admin' => array('id' => 1, 'username' => 'admin', 'name' => ''),
    'firstname.lastname' => array('id' => 2, 'username' => 'firstname.lastname', 'name' => 'Firstname Lastname'),
);
$container = new Container();
$container['helper'] = (object) array('url' => $url);
$container['userCacheDecorator'] = new class($users) {
    private $users;
    public function __construct($u) { $this->users = $u; }
    public function getByUsername($n) { return isset($this->users[$n]) ? $this->users[$n] : null; }
};
$container['taskFinderModel'] = new stdClass();
$container['memoryCache'] = new class {
    public function proxy($o, $m, $id) { return $id == 1 ? 'tok1' : ''; }
};

$cases = json_decode(file_get_contents(__DIR__.'/inputs.json'), true);
$out = array();
foreach ($cases as $case) {
    foreach (array(false, true) as $public) {
        $p = new Markdown($container, $public);
        $p->setSafeMode(true);
        $p->setMarkupEscaped(true);
        $p->setBreaksEnabled(true);
        $out[] = array('input' => $case, 'public' => $public, 'output' => $p->text($case));
    }
}
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";

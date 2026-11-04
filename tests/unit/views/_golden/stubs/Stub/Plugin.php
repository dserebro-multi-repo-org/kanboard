<?php

namespace Kanboard\Plugin\Stub;

use Kanboard\Core\Plugin\Base;

/** Empty plugin: only exists so that PLUGINS_DIR can point at the template stubs used by the golden tests. */
class Plugin extends Base
{
    public function initialize() {}
    public function getPluginName() { return 'Stub'; }
    public function getPluginAuthor() { return 'test'; }
    public function getPluginVersion() { return '1.0.0'; }
    public function getPluginDescription() { return 'Template stubs of the golden tests'; }
    public function getPluginHomepage() { return 'https://kanboard.org'; }
}

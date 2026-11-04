<?php
/**
 * One-off converter: app/Locale/<code>/translations.php  ->  locales/<code>.json
 *
 * Output directory: <project root>/locales/ (NOT src/locales). It is resolved by the TypeScript
 * Translator relative to the module (src/core/translator or dist/core/translator -> ../../../locales),
 * so it works for `tsx`, vitest and the compiled `dist/` output without a build copy step
 * (tsc does not copy .json files that are not imported).
 *
 * Usage: php scripts/convert-locales.php
 */

$root = dirname(__DIR__);
$out = $root.'/locales';
if (! is_dir($out) && ! mkdir($out, 0775, true)) {
    fwrite(STDERR, "Cannot create $out\n");
    exit(1);
}

$total = 0;
foreach (glob($root.'/app/Locale/*', GLOB_ONLYDIR) as $dir) {
    $code = basename($dir);
    $file = $dir.'/translations.php';
    if (! is_file($file)) {
        continue;
    }
    $data = require $file;
    $data = array_map('strval', $data);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
    file_put_contents($out.'/'.$code.'.json', $json."\n");
    printf("%s: %d keys\n", $code, count($data));
    $total++;
}
echo "$total locales converted\n";

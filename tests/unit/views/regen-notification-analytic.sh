#!/bin/sh
# Regenerates tests/unit/views/{notification,analytic}/fixtures/*.html from the real PHP templates.
cd "$(dirname "$0")/../../.." || exit 1
for dir in notification analytic; do
  mkdir -p tests/unit/views/$dir/fixtures
  for name in $(php -r '$c=json_decode(file_get_contents("tests/unit/views/'$dir'/cases.json"),true);foreach($c as $x)echo $x["name"],"\n";'); do
    php tests/unit/views/gen-notification-analytic.php $dir $name > tests/unit/views/$dir/fixtures/$name.html || echo "FAILED $dir/$name"
  done
done

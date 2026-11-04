import { goldenSuite } from '../_golden/run.js';

// Golden tests of src/views (app templates) against the output of the original PHP templates.
goldenSuite('views: app', 'app.json');

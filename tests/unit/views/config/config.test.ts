import { goldenSuite } from '../_golden/run.js';

// Golden tests of src/views (config templates) against the output of the original PHP templates.
goldenSuite('views: config', 'config.json');

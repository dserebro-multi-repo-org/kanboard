import { goldenSuite } from '../_golden/run.js';

// Golden tests of src/views (header templates) against the output of the original PHP templates.
goldenSuite('views: header', 'header.json');

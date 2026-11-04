import { goldenSuite } from '../_golden/run.js';

// Golden tests of src/views (layout templates) against the output of the original PHP templates.
goldenSuite('views: layout', 'layout.json');

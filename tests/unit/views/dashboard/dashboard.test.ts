import { goldenSuite } from '../_golden/run.js';

// Golden tests of src/views (dashboard templates) against the output of the original PHP templates.
goldenSuite('views: dashboard', 'dashboard.json');

import { goldenSuite } from '../_golden/run.js';

// Golden tests of src/views (project_header templates) against the output of the original PHP templates.
goldenSuite('views: project_header', 'project_header.json');

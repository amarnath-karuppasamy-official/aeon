// Client entry. This site ships prerendered HTML (see src/ssg.js and the
// "SSG" section of the docs), so the client bundle HYDRATES the existing
// server-rendered DOM instead of mount()-ing fresh — hydrateComponent()
// adopts the real nodes @aeon-framework/ssg's prerender() already wrote,
// attaches event listeners, and leaves everything else alone (no flash).
import { hydrateComponent } from '@aeon-framework/core';
import { router, App } from './ssg.js';

router.start();
hydrateComponent(App, document.getElementById('app'));

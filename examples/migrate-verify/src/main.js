// This mounts Sample.aeon.jsx exactly as the codemod produced it — unedited —
// to prove the generated code actually runs, not just parses. (It keeps a
// .jsx extension because the untouched, skipped `Clock` component inside it
// still contains real JSX — see packages/migrate.)
import { mount } from '@aeon-framework/core';
import Counter from './Sample.aeon.jsx';

mount(Counter, document.getElementById('app'));

import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AeonView, useAeonSignal } from '@aeon-framework/interop/react';
import { AeonCounter, sharedCount } from '../../shared/aeon-counter.js';

function App() {
  // A completely ordinary React component — its own state, nothing Aeon-aware.
  const [reactCount, setReactCount] = useState(0);
  // ...reading an Aeon signal into React, so both sides can watch the same value.
  const sharedFromAeon = useAeonSignal(sharedCount);

  return createElement(
    'div',
    { style: { fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '3rem auto' } },
    createElement('h1', null, 'React app, with an Aeon leaf'),
    createElement(
      'section',
      null,
      createElement('h2', null, 'Native React state'),
      createElement('p', { id: 'react-out' }, `React count: ${reactCount}`),
      createElement('button', { id: 'react-btn', onClick: () => setReactCount((c) => c + 1) }, '+1 (from React)')
    ),
    createElement(
      'section',
      null,
      createElement('h2', null, 'Aeon component, mounted inside React'),
      createElement(AeonView, { component: AeonCounter })
    ),
    createElement(
      'section',
      null,
      createElement('h2', null, 'React reading the Aeon signal above'),
      createElement('p', { id: 'react-reads-aeon' }, `React sees Aeon's count as: ${sharedFromAeon}`)
    )
  );
}

createRoot(document.getElementById('root')).render(createElement(App));

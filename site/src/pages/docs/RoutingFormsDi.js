import { html } from '@aeon-framework/core';
import Header from '../../components/Header.js';
import Footer from '../../components/Footer.js';
import DocsLayout from '../../components/DocsLayout.js';
import CodeBlock from '../../components/CodeBlock.js';
import { BASE, link } from '../../router.js';

const routerCode = `import { createRouter, outlet, link } from '@aeon-framework/router';

const router = createRouter(
  [
    { path: '/', component: Home },
    { path: '/users/:id', component: UserDetail },
    { path: '*', component: NotFound },
  ],
  { mode: 'hash' } // or 'history'
);

router.start();
// in a template: \${() => outlet(router)}   and   \${link(router, '/users/1', 'Ada')}`;

const guardCode = `const router = createRouter([
  { path: '/', component: Home },
  {
    path: '/admin',
    component: AdminDashboard,
    guard: async (to, from) => {
      const ok = await session.isAuthenticated();
      if (!ok) return '/login'; // redirect instead of entering
      return true; // allow
    },
  },
  { path: '/login', component: Login },
]);`;

const formsCode = `import { control, group, validators } from '@aeon-framework/forms';

const form = group({
  email: control('', [validators.required(), validators.email()]),
});

// form.controls.email.value / .errors / .touched / .valid are all signals —
// bind them directly in a template, no separate "form state" object.`;

const diCode = `import { createToken, provide, inject } from '@aeon-framework/di';

const Logger = createToken('Logger');
provide(Logger, () => ({ log: (msg) => console.log(msg) }));

// anywhere downstream:
const logger = inject(Logger);`;

export default function RoutingFormsDi() {
  return html`
    ${Header()}
    ${DocsLayout({
      active: `${BASE}/docs/routing-forms-di`,
      children: html`
        <h1>Routing, forms &amp; DI</h1>

        <h2>Router</h2>
        <p>
          <code>createRouter()</code> takes a route table and an optional <code>mode</code>
          (<code>'hash'</code> or <code>'history'</code>, the default). Bind <code>outlet(router)</code>
          reactively in a template to render whatever route currently matches, and use
          <code>link(router, to, children)</code> for navigable links that go through the
          router instead of a full page load.
        </p>
        ${CodeBlock({ code: routerCode, lang: 'js' })}
        <p>
          In history mode, a hard refresh on a non-root route needs the <em>server</em> to
          respond with the app shell for that URL too. <code>aeon dev</code> handles this with a
          small SPA-fallback proxy in front of esbuild's dev server; a production static host
          needs the equivalent rule (Netlify's <code>_redirects</code>, nginx's
          <code>try_files</code>, etc.) — or you can prerender every route at build time (see
          ${link(`${BASE}/docs/rendering`, 'SSR, SSG & rendering')}), which is what this
          site itself does, so there's no fallback rule to configure at all.
        </p>

        <h3>Route guards</h3>
        <p>
          A route can carry a <code>guard</code> — Angular calls this <code>CanActivate</code> —
          run before the route is entered:
        </p>
        ${CodeBlock({ code: guardCode, lang: 'js' })}
        <p>
          Return (or resolve to) <code>true</code> to allow the navigation, <code>false</code> to
          block it (the matched route is left exactly as it was), or a path string to redirect
          there instead. <code>navigate()</code> genuinely <code>await</code>s an async guard
          before committing anything, and <code>router.start()</code>'s initial sync runs the
          same guard check against the URL the page loaded on — a guarded route can't be reached
          by a hard refresh either.
        </p>

        <h2>Forms</h2>
        <p>
          <code>control()</code> wraps a single value with composable <code>validators</code>;
          <code>group()</code> composes controls into a form. Every control's
          <code>.value</code>/<code>.errors</code>/<code>.touched</code>/<code>.valid</code> is a
          signal — bind them directly in a template, no separate "form state" object to keep in
          sync.
        </p>
        ${CodeBlock({ code: formsCode, lang: 'js' })}

        <h2>Dependency injection</h2>
        <p>
          <code>createToken()</code> + <code>provide()</code> + <code>inject()</code> are plain
          functions — no decorators, no NgModules, no reflect-metadata. A scoped
          <code>Container</code> is available for cases that need more than the default global
          scope.
        </p>
        ${CodeBlock({ code: diCode, lang: 'js' })}
      `,
    })}
    ${Footer()}
  `;
}

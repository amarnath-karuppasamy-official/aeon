import { mount, html } from '@aeon-framework/core';
import { createRouter, outlet, link } from '@aeon-framework/router';
import { provide } from '@aeon-framework/di';
import { GreetingService, createGreetingService } from './services/greeting.js';
import Home from './pages/Home.js';
import About from './pages/About.js';
import Users from './pages/Users.js';
import UserDetail from './pages/UserDetail.js';
import Contact from './pages/Contact.js';
import NotFound from './pages/NotFound.js';

provide(GreetingService, createGreetingService);

const router = createRouter(
  [
    { path: '/', component: Home },
    { path: '/about', component: About },
    { path: '/users', component: Users },
    { path: '/users/:id', component: UserDetail },
    { path: '/contact', component: Contact },
    { path: '*', component: NotFound },
  ],
  { mode: 'hash' }
);

function App() {
  return html`
    <header>
      <h1>&#9889; Aeon</h1>
      <nav>
        ${link(router, '/', 'Home')} ${link(router, '/about', 'About')} ${link(router, '/users', 'Users')}
        ${link(router, '/contact', 'Contact')}
      </nav>
      <hr />
    </header>
    <main>${() => outlet(router)}</main>
  `;
}

router.start();
mount(App, document.getElementById('app'));

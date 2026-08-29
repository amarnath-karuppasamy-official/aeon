import { html, computed } from '@aeon-framework/core';
import { users } from './Users.js';

export default function UserDetail({ params }) {
  const user = computed(() => users.value.find((u) => String(u.id) === params.id));
  return html`
    <section>
      <p><a href="#/users">&larr; back to users</a></p>
      ${() =>
        user.value
          ? html`<h2>${user.value.name}</h2>
              <p>id: ${user.value.id}</p>`
          : html`<p>No user with id ${params.id}.</p>`}
    </section>
  `;
}

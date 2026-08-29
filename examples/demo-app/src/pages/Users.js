import { html, signal, list } from '@aeon/core';

let nextId = 4;
export const users = signal([
  { id: 1, name: 'Ada Lovelace' },
  { id: 2, name: 'Grace Hopper' },
  { id: 3, name: 'Alan Turing' },
]);

function shuffle() {
  users.value = [...users.value].sort(() => Math.random() - 0.5);
}

function addUser() {
  users.value = [...users.value, { id: nextId, name: `New User ${nextId}` }];
  nextId++;
}

function removeUser(id) {
  users.value = users.value.filter((u) => u.id !== id);
}

export default function Users() {
  return html`
    <section>
      <h2>Users (keyed list)</h2>
      <p>Rows are reordered, not rebuilt — inspect the DOM while shuffling.</p>
      <button @click=${addUser}>Add user</button>
      <button @click=${shuffle}>Shuffle</button>
      <ul class="users">
        ${() =>
          list(
            () => users.value,
            (u) => u.id,
            (u) => html`
              <li>
                <a href=${`#/users/${u.id}`}>${u.name}</a>
                <button @click=${() => removeUser(u.id)}>remove</button>
              </li>
            `
          )}
      </ul>
    </section>
  `;
}

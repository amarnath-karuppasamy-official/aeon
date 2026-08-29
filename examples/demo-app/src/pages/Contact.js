import { html, signal } from '@aeon/core';
import { control, group, validators } from '@aeon/forms';

export default function Contact() {
  const form = group({
    name: control('', [validators.required()]),
    email: control('', [validators.required(), validators.email()]),
    message: control('', [validators.required(), validators.minLength(10)]),
  });
  const submitted = signal(false);

  function onSubmit(e) {
    e.preventDefault();
    form.markAllTouched();
    if (form.valid.value) submitted.value = true;
  }

  const field = (ctrl, label, type = 'text') => html`
    <label>
      ${label}<br />
      <input
        type=${type}
        .value=${() => ctrl.value.value}
        @input=${(e) => ctrl.setValue(e.target.value)}
        @blur=${() => ctrl.markTouched()}
      />
    </label>
    ${() =>
      ctrl.touched.value && ctrl.errors.value.length
        ? html`<div class="error">${ctrl.errors.value[0]}</div>`
        : null}
  `;

  return html`
    <section>
      <h2>Reactive forms</h2>
      ${() => (submitted.value ? html`<p>Thanks — form is valid and "submitted".</p>` : null)}
      <form @submit=${onSubmit}>
        ${field(form.controls.name, 'Name')}
        ${field(form.controls.email, 'Email', 'email')}
        <label>
          Message<br />
          <textarea
            .value=${() => form.controls.message.value.value}
            @input=${(e) => form.controls.message.setValue(e.target.value)}
            @blur=${() => form.controls.message.markTouched()}
          ></textarea>
        </label>
        ${() =>
          form.controls.message.touched.value && form.controls.message.errors.value.length
            ? html`<div class="error">${form.controls.message.errors.value[0]}</div>`
            : null}
        <p><button type="submit">Submit</button></p>
        <p>Form valid: ${() => String(form.valid.value)}</p>
      </form>
    </section>
  `;
}

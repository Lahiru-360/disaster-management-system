// Abstract base for email templates. Message bodies are rendered by a
// template, never assembled inline by callers: render() returns an
// already-rendered { subject, html, text } object — exactly what
// EmailService.send() expects alongside `to` — so EmailService never has to
// know what kind of message it is sending. Subclasses supply the three parts.
export class EmailTemplate {
  get subject() {
    return this.#notImplemented('subject');
  }

  get html() {
    return this.#notImplemented('html');
  }

  get text() {
    return this.#notImplemented('text');
  }

  render() {
    return { subject: this.subject, html: this.html, text: this.text };
  }

  #notImplemented(part) {
    throw new Error(`${this.constructor.name} must define ${part}`);
  }
}

import { EmailTemplate } from './EmailTemplate.js';

// The email a post-event report is shared with (UC04 step 15, contract §14.9):
// the officer's message, what the report covers, who shared it and the link
// to the exported file. The message and names are typed by people, so they
// are escaped before they go into the HTML body.
export class ReportShareEmail extends EmailTemplate {
  #eventName;
  #hazardType;
  #dateFrom;
  #dateTo;
  #sharedByName;
  #message;
  #fileUrl;
  #format;

  constructor({ eventName, hazardType, dateFrom, dateTo, sharedByName, message, fileUrl, format }) {
    super();
    this.#eventName = eventName;
    this.#hazardType = hazardType;
    this.#dateFrom = dateFrom;
    this.#dateTo = dateTo;
    this.#sharedByName = sharedByName;
    this.#message = message;
    this.#fileUrl = fileUrl;
    this.#format = format;
  }

  get subject() {
    return `Post-event report – ${this.#eventName}`;
  }

  get html() {
    const covers = `${ReportShareEmail.#escape(this.#eventName)} (${ReportShareEmail.#escape(this.#hazardType)}), ${this.#dateFrom} to ${this.#dateTo}`;
    return `<p>${ReportShareEmail.#escape(this.#message)}</p><p>The Disaster Management Centre has shared a post-event analysis report with you. It covers ${covers}.</p><p><a href="${ReportShareEmail.#escape(this.#fileUrl)}">Download the report (${this.#format})</a></p><p>Shared by ${ReportShareEmail.#escape(this.#sharedByName)}.</p>`;
  }

  get text() {
    return `${this.#message}\n\nThe Disaster Management Centre has shared a post-event analysis report with you. It covers ${this.#eventName} (${this.#hazardType}), ${this.#dateFrom} to ${this.#dateTo}.\n\nDownload the report (${this.#format}):\n${this.#fileUrl}\n\nShared by ${this.#sharedByName}.`;
  }

  static #escape(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}

import { EmailTemplate } from '../../../src/services/email/EmailTemplate.js';
import { ReportShareEmail } from '../../../src/services/email/ReportShareEmail.js';

const emailFields = (fields = {}) => ({
  eventName: 'Kelani basin floods',
  hazardType: 'FLOOD',
  dateFrom: '2026-06-08',
  dateTo: '2026-06-20',
  sharedByName: 'Kasun Silva',
  message: 'Post-event summary',
  fileUrl: 'https://files.example.test/reports/0b6f3c1e.pdf',
  format: 'PDF',
  ...fields,
});

describe('ReportShareEmail', () => {
  it('DMS-155.3: is an EmailTemplate that renders a subject, html and text', () => {
    const email = new ReportShareEmail(emailFields());

    expect(email).toBeInstanceOf(EmailTemplate);
    expect(Object.keys(email.render()).sort()).toEqual(['html', 'subject', 'text']);
  });

  it('DMS-155.3: names the event in the subject', () => {
    const { subject } = new ReportShareEmail(emailFields()).render();

    expect(subject).toBe('Post-event report – Kelani basin floods');
  });

  it('DMS-155.3: carries the message, the period, the sender and the file link in both bodies', () => {
    const { html, text } = new ReportShareEmail(emailFields()).render();

    for (const body of [html, text]) {
      expect(body).toContain('Post-event summary');
      expect(body).toContain('Kelani basin floods');
      expect(body).toContain('2026-06-08 to 2026-06-20');
      expect(body).toContain('Kasun Silva');
      expect(body).toContain('https://files.example.test/reports/0b6f3c1e.pdf');
    }
    expect(html).toContain('<a href="https://files.example.test/reports/0b6f3c1e.pdf">');
  });

  it('DMS-155.3: escapes the typed message and names in the HTML body only', () => {
    const { html, text } = new ReportShareEmail(
      emailFields({ message: '<script>alert("x")</script> & more', sharedByName: "O'Neil" }),
    ).render();

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more');
    expect(html).toContain('O&#39;Neil');
    expect(text).toContain('<script>alert("x")</script> & more');
  });
});

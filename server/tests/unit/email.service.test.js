import { jest } from '@jest/globals';

// CI must never reach a real Brevo account. The client is stubbed at the
// `@getbrevo/brevo` boundary — one level below email.service.js — so the
// service's own transport-selection and error-mapping logic still runs for
// real; only the network call underneath it is replaced.
const mockSendTransacEmail = jest.fn();

jest.unstable_mockModule('@getbrevo/brevo', () => ({
  BrevoClient: jest.fn().mockImplementation(() => ({
    transactionalEmails: { sendTransacEmail: mockSendTransacEmail },
  })),
}));

const message = { to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

// email.service.js reads env.emailTransport at import time (via config/env.js),
// so each scenario resets the module registry and re-imports to pick up the
// env vars it just set.
const importEmailService = async () => {
  jest.resetModules();
  return import('../../src/services/email.service.js');
};

describe('email.service', () => {
  beforeEach(() => {
    mockSendTransacEmail.mockReset();
    delete process.env.EMAIL_TRANSPORT;
    delete process.env.EMAIL_FROM;
    delete process.env.BREVO_API_KEY;
  });

  it('the no-op transport records the message it was asked to send and reports success', async () => {
    const { sendEmail, getSentEmails, clearSentEmails } = await importEmailService();
    clearSentEmails();

    await expect(sendEmail(message)).resolves.toBeUndefined();

    expect(getSentEmails()).toEqual([message]);
    expect(mockSendTransacEmail).not.toHaveBeenCalled();
  });

  it('defaults to the no-op transport when EMAIL_TRANSPORT is unset', async () => {
    expect(process.env.EMAIL_TRANSPORT).toBeUndefined();

    const { sendEmail, getSentEmails, clearSentEmails } = await importEmailService();
    clearSentEmails();

    await sendEmail(message);

    expect(getSentEmails()).toHaveLength(1);
    expect(mockSendTransacEmail).not.toHaveBeenCalled();
  });

  it('surfaces a stubbed provider failure as 502 EMAIL_UNAVAILABLE', async () => {
    process.env.EMAIL_TRANSPORT = 'brevo';
    process.env.EMAIL_FROM = 'no-reply@example.com';
    process.env.BREVO_API_KEY = 'test-key';
    mockSendTransacEmail.mockRejectedValue(new Error('Invalid API key'));

    const { sendEmail } = await importEmailService();

    await expect(sendEmail(message)).rejects.toMatchObject({
      status: 502,
      code: 'EMAIL_UNAVAILABLE',
    });
  });
});

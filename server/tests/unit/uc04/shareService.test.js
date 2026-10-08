import { jest } from '@jest/globals';
import { ExportFormat } from '../../../src/enums/ExportFormat.js';
import { ShareService } from '../../../src/services/ShareService.js';
import { ApiError } from '../../../src/utils/ApiError.js';
import { FakeClock } from '../../helpers/FakeClock.js';

// ShareService (DMS-155.4, contract §14.9) with fake report and export
// services, models and email service: it checks the report and organisation
// first, shares the report's export (making one if needed), sends the email
// and records the share.
const NOW = '2026-10-07T09:45:00.000Z';
const officer = { id: 'u-1', name: 'Kasun Silva' };
const report = {
  id: 'r-1',
  dateFrom: '2026-06-08',
  dateTo: '2026-06-20',
  event: { name: 'Kelani basin floods', hazardType: 'FLOOD' },
};
const exported = { exportId: 'x-1', format: 'PDF', fileUrl: 'https://files/reports/a.pdf' };
const input = {
  organisationId: 'o-1',
  recipientEmail: 'liaison@example.org',
  message: 'Post-event summary',
};

const setup = ({ organisation = { _id: 'o-1', name: 'UNICEF Sri Lanka' } } = {}) => {
  const deps = {
    reportService: { findById: jest.fn(async () => report) },
    exportService: { findOrCreate: jest.fn(async () => exported) },
    organisationModel: { findById: jest.fn(async () => organisation) },
    // A saved share that populates and plain-objects like a Mongoose document.
    shareModel: {
      create: jest.fn(async (fields) => ({
        populate: async () => undefined,
        toObject: () => ({
          _id: 's-1',
          ...fields,
          export: { _id: fields.export, format: exported.format, fileUrl: exported.fileUrl },
          organisation: { _id: fields.organisation, name: 'UNICEF Sri Lanka' },
          sharedBy: { _id: fields.sharedBy, name: officer.name },
        }),
      })),
    },
    emailService: { send: jest.fn(async () => undefined) },
    clock: new FakeClock(NOW),
  };
  return { service: new ShareService(deps), ...deps };
};

describe('ShareService.share', () => {
  const shareOf = async (service, fields = {}) => {
    try {
      await service.share(officer, 'r-1', { ...input, ...fields });
    } catch (err) {
      return err;
    }
    return null;
  };

  it('DMS-155.4: shares the export in the requested format, defaulting to PDF', async () => {
    const { service, exportService } = setup();

    await shareOf(service);
    await shareOf(service, { format: ExportFormat.CSV });

    expect(exportService.findOrCreate).toHaveBeenNthCalledWith(1, officer, 'r-1', 'PDF');
    expect(exportService.findOrCreate).toHaveBeenNthCalledWith(2, officer, 'r-1', 'CSV');
  });

  it('DMS-155.4: emails the recipient the rendered template with the file link', async () => {
    const { service, emailService } = setup();

    await shareOf(service);

    const [message] = emailService.send.mock.calls[0];
    expect(message.to).toBe('liaison@example.org');
    expect(message.subject).toBe('Post-event report – Kelani basin floods');
    expect(message.html).toContain('https://files/reports/a.pdf');
    expect(message.text).toContain('Kasun Silva');
  });

  it('DMS-155.4: returns the share object with the export, organisation and officer', async () => {
    const { service } = setup();

    const share = await service.share(officer, 'r-1', input);

    expect(share).toEqual({
      shareId: 's-1',
      exportId: 'x-1',
      format: 'PDF',
      fileUrl: 'https://files/reports/a.pdf',
      organisation: { id: 'o-1', name: 'UNICEF Sri Lanka' },
      recipientEmail: 'liaison@example.org',
      message: 'Post-event summary',
      sharedBy: { id: 'u-1', name: 'Kasun Silva' },
      sharedAt: new Date(NOW),
      status: 'SENT',
      attempts: 1,
      failureReason: null,
    });
  });

  it('DMS-155.4: records a SENT share with the export, officer and clock time', async () => {
    const { service, shareModel } = setup();

    await shareOf(service);

    expect(shareModel.create).toHaveBeenCalledWith({
      report: 'r-1',
      export: 'x-1',
      organisation: 'o-1',
      recipientEmail: 'liaison@example.org',
      message: 'Post-event summary',
      sharedBy: 'u-1',
      sharedAt: new Date(NOW),
      status: 'SENT',
      attempts: 1,
      failureReason: null,
    });
  });

  it('TC-47 E4: a transport error that is not an ApiError is answered as the standard 502 and recorded with its own reason', async () => {
    const { service, emailService, shareModel } = setup();
    emailService.send.mockRejectedValue(new Error('socket hang up'));

    const err = await shareOf(service);

    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.code, err.message]).toEqual([
      502,
      'EMAIL_UNAVAILABLE',
      'Could not send the email. Please try again.',
    ]);
    expect(shareModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', failureReason: 'socket hang up' }),
    );
  });

  it('TC-47 E4: a failure with no message gets a default reason, and a long one is cut to 500 characters', async () => {
    const { service, emailService, shareModel } = setup();
    emailService.send.mockRejectedValueOnce(new Error(''));
    emailService.send.mockRejectedValueOnce(new Error('x'.repeat(900)));

    await shareOf(service);
    await shareOf(service);

    const reasons = shareModel.create.mock.calls.map(([fields]) => fields.failureReason);
    expect(reasons[0]).toBe('The email could not be sent.');
    expect(reasons[1]).toHaveLength(500);
  });

  it('TC-27 Main 14: an unknown organisation is 404, with no export, email or share', async () => {
    const { service, exportService, emailService, shareModel } = setup({ organisation: null });

    const err = await shareOf(service);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(exportService.findOrCreate).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
    expect(shareModel.create).not.toHaveBeenCalled();
  });

  it('TC-27 Main 14: an unknown report is 404 before the organisation is even looked up', async () => {
    const { service, reportService, organisationModel } = setup();
    reportService.findById.mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Post-event report not found.'),
    );

    const err = await shareOf(service);

    expect(err.status).toBe(404);
    expect(organisationModel.findById).not.toHaveBeenCalled();
  });

  it('TC-47 E4: a failed email records a FAILED share with the reason, then answers 502', async () => {
    const { service, emailService, shareModel } = setup();
    emailService.send.mockRejectedValue(
      new ApiError(502, 'EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.'),
    );

    const err = await shareOf(service);

    expect(err.code).toBe('EMAIL_UNAVAILABLE');
    expect(shareModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FAILED',
        attempts: 1,
        failureReason: 'Could not send the email. Please try again.',
      }),
    );
  });
});

describe('ShareService.retry (E4)', () => {
  const failedShare = (fields = {}) => ({
    status: 'FAILED',
    attempts: 1,
    failureReason: 'Could not send the email. Please try again.',
    report: 'r-1',
    recipientEmail: 'liaison@example.org',
    message: 'Post-event summary',
    sharedAt: new Date('2026-10-07T09:00:00.000Z'),
    sharedBy: { _id: 'u-1', name: 'Kasun Silva' },
    export: { _id: 'x-1', format: 'PDF', fileUrl: 'https://files/reports/a.pdf' },
    organisation: { _id: 'o-1', name: 'UNICEF Sri Lanka' },
    save: jest.fn(async () => undefined),
    toObject() {
      const plain = Object.entries(this).filter(([, value]) => typeof value !== 'function');
      return { _id: 's-1', ...Object.fromEntries(plain) };
    },
    ...fields,
  });

  const setupRetry = (share) => {
    const ctx = setup();
    ctx.shareModel.findById = jest.fn(() => ({ populate: async () => share }));
    return ctx;
  };

  it('TC-48 E4: a retry that works makes the same share SENT with a new time and attempts + 1', async () => {
    const share = failedShare();
    const { service, emailService } = setupRetry(share);

    const result = await service.retry('5f1d7f3e9b1e8a0017a3c111');

    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(share.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        shareId: 's-1',
        status: 'SENT',
        attempts: 2,
        failureReason: null,
        sharedAt: new Date(NOW),
      }),
    );
  });

  it('TC-49 E4: a retry that fails again stays FAILED, raises attempts and keeps sharedAt', async () => {
    const share = failedShare();
    const { service, emailService } = setupRetry(share);
    emailService.send.mockRejectedValue(new Error('socket hang up'));

    await expect(service.retry('5f1d7f3e9b1e8a0017a3c111')).rejects.toMatchObject({
      status: 502,
      code: 'EMAIL_UNAVAILABLE',
    });

    expect(share).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        attempts: 2,
        failureReason: 'socket hang up',
        sharedAt: new Date('2026-10-07T09:00:00.000Z'),
      }),
    );
    expect(share.save).toHaveBeenCalledTimes(1);
  });

  it('TC-50 E4: a SENT share is 409 INVALID_SHARE_TRANSITION, with nothing sent or saved', async () => {
    const share = failedShare({ status: 'SENT' });
    const { service, emailService } = setupRetry(share);

    await expect(service.retry('5f1d7f3e9b1e8a0017a3c111')).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_SHARE_TRANSITION',
    });

    expect(emailService.send).not.toHaveBeenCalled();
    expect(share.save).not.toHaveBeenCalled();
  });

  it('DMS-162.4: a share no one has, or an invalid id, is 404', async () => {
    const { service, shareModel } = setupRetry(null);

    await expect(service.retry('5f1d7f3e9b1e8a0017a3c111')).rejects.toMatchObject({ status: 404 });
    await expect(service.retry('not-an-id')).rejects.toMatchObject({ status: 404 });
    expect(shareModel.findById).toHaveBeenCalledTimes(1);
  });

  it('DMS-162.4: names the sharer in the retried email, or a DMC officer if the account is gone', async () => {
    const { service, emailService } = setupRetry(failedShare({ sharedBy: null }));

    await service.retry('5f1d7f3e9b1e8a0017a3c111');

    expect(emailService.send.mock.calls[0][0].text).toContain('a DMC officer');
  });
});

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
    });
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

  it('DMS-155.4: a failed email records no share', async () => {
    const { service, emailService, shareModel } = setup();
    emailService.send.mockRejectedValue(
      new ApiError(502, 'EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.'),
    );

    const err = await shareOf(service);

    expect(err.code).toBe('EMAIL_UNAVAILABLE');
    expect(shareModel.create).not.toHaveBeenCalled();
  });
});

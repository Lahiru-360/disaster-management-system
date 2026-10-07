import mongoose from 'mongoose';
import { ShareStatus } from '../../../src/enums/ShareStatus.js';
import { ReportShare } from '../../../src/models/ReportShare.js';

const shareFields = (fields = {}) => ({
  report: new mongoose.Types.ObjectId(),
  export: new mongoose.Types.ObjectId(),
  organisation: new mongoose.Types.ObjectId(),
  recipientEmail: 'liaison@example.org',
  message: 'Post-event summary',
  sharedBy: new mongoose.Types.ObjectId(),
  sharedAt: new Date('2026-10-07T09:45:00.000Z'),
  ...fields,
});

// The messages Mongoose collected, by path, or {} when the document is valid.
const errorsOf = async (doc) => {
  try {
    await doc.validate();
    return {};
  } catch (err) {
    return Object.fromEntries(Object.entries(err.errors).map(([path, e]) => [path, e.message]));
  }
};

describe('ShareStatus', () => {
  it('DMS-155.2: is SENT or FAILED, and is frozen', () => {
    expect(Object.values(ShareStatus)).toEqual(['SENT', 'FAILED']);
    expect(Object.isFrozen(ShareStatus)).toBe(true);
  });
});

describe('ReportShare model', () => {
  it('DMS-155.2: stores a share as SENT, with the sharedAt it is given', async () => {
    const sharedAt = new Date('2026-10-07T09:45:00.000Z');

    const saved = await ReportShare.create(shareFields({ sharedAt }));

    expect(saved.status).toBe(ShareStatus.SENT);
    expect(saved.sharedAt).toEqual(sharedAt);
    expect(saved.toJSON()).toEqual(
      expect.objectContaining({ id: saved._id, recipientEmail: 'liaison@example.org' }),
    );
    expect(saved.toJSON()).not.toHaveProperty('_id');
    expect(saved.toJSON()).not.toHaveProperty('__v');
  });

  it('DMS-155.2: trims the recipient email and the message', async () => {
    const saved = await ReportShare.create(
      shareFields({ recipientEmail: '  liaison@example.org ', message: '  Hello  ' }),
    );

    expect(saved.recipientEmail).toBe('liaison@example.org');
    expect(saved.message).toBe('Hello');
  });

  it('DMS-155.2: needs a report, an export, an organisation, an email, a message, the officer and a time', async () => {
    const errors = await errorsOf(new ReportShare({}));

    expect(Object.keys(errors).sort()).toEqual([
      'export',
      'message',
      'organisation',
      'recipientEmail',
      'report',
      'sharedAt',
      'sharedBy',
    ]);
  });

  it('DMS-155.2: refuses a status that is not a ShareStatus', async () => {
    const errors = await errorsOf(new ReportShare(shareFields({ status: 'PENDING' })));

    expect(Object.keys(errors)).toEqual(['status']);
  });

  it('DMS-155.2: accepts FAILED', async () => {
    const saved = await ReportShare.create(shareFields({ status: ShareStatus.FAILED }));

    expect(saved.status).toBe(ShareStatus.FAILED);
  });

  it('DMS-155.2: refuses a message over 500 characters', async () => {
    const errors = await errorsOf(new ReportShare(shareFields({ message: 'x'.repeat(501) })));

    expect(Object.keys(errors)).toEqual(['message']);
  });

  it('DMS-162.1: starts at one attempt with no failure reason', async () => {
    const saved = await ReportShare.create(shareFields());

    expect(saved.attempts).toBe(1);
    expect(saved.failureReason).toBeNull();
  });

  it('DMS-162.1: refuses fewer than one attempt and a failure reason over 500 characters', async () => {
    const errors = await errorsOf(
      new ReportShare(shareFields({ attempts: 0, failureReason: 'x'.repeat(501) })),
    );

    expect(Object.keys(errors).sort()).toEqual(['attempts', 'failureReason']);
  });
});

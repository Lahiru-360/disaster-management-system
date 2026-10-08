// Every model a share references, so populate() finds each one registered.
import '../../models/Organisation.js';
import '../../models/ReportExport.js';
import '../../models/User.js';

// Turns a stored ReportShare into the contract's share object (§14.9): the
// export's format and file link, and the organisation and officer as small
// references.
export class ReportSharePresenter {
  static POPULATE = [
    { path: 'export', select: 'format fileUrl' },
    { path: 'organisation', select: 'name' },
    { path: 'sharedBy', select: 'name' },
  ];

  /**
   * @param {import('mongoose').Document} doc A ReportShare document.
   * @returns {Promise<object>}
   */
  static async present(doc) {
    await doc.populate(ReportSharePresenter.POPULATE);
    return ReportSharePresenter.listItem(doc.toObject());
  }

  /**
   * A share row, for the shares list (§14.10). Expects the share already
   * populated and plain.
   * @param {object} json A populated ReportShare.
   * @returns {object}
   */
  static listItem(json) {
    return {
      shareId: String(json._id),
      exportId: String(json.export._id),
      format: json.export.format,
      fileUrl: json.export.fileUrl,
      organisation: { id: String(json.organisation._id), name: json.organisation.name },
      recipientEmail: json.recipientEmail,
      message: json.message,
      // null if the officer's account has since been removed.
      sharedBy: json.sharedBy ? { id: String(json.sharedBy._id), name: json.sharedBy.name } : null,
      sharedAt: json.sharedAt,
      status: json.status,
    };
  }
}

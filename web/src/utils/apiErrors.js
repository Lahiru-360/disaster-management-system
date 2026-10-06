// Reads the server's error envelope (docs/api-contract.md §3) from a failed
// API call: the same for the real client (an axios rejection) and the mocks.
// Shared by every form that shows a VALIDATION_ERROR on its fields (R-5:
// UC01 E1 target scope, UC04 E1 report filters).

/**
 * The error's message for a Notice, or `fallback` when the call never got
 * an answer (offline, timeout) or the answer carries none.
 * @param {unknown} error
 * @param {string} fallback
 * @returns {string}
 */
export function apiErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message ?? fallback;
}

/**
 * Maps a 400's `errors: [{ field, message }]` onto the form's fields. A
 * nested path counts as its top-level field ("areaIds.0" is "areaIds"), and
 * the first message for a field wins. Entries for a field the form doesn't
 * show are returned in `others` as "field: message", for a Notice.
 * @param {unknown} error
 * @param {string[]} formFields The fields the form can highlight.
 * @returns {{ byField: Record<string, string>, others: string[] }}
 */
export function mapFieldErrors(error, formFields) {
  const entries = error?.response?.data?.error?.errors ?? [];
  const byField = {};
  const others = [];

  for (const { field = '', message } of entries) {
    const topLevel = String(field).split('.')[0];
    if (formFields.includes(topLevel)) {
      byField[topLevel] ??= message;
    } else {
      others.push(topLevel ? `${topLevel}: ${message}` : message);
    }
  }
  return { byField, others };
}

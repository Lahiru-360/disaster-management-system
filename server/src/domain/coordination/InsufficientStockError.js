import { ApiError } from '../../utils/ApiError.js';

// UC03 E5: a distribution of 0 or less, or of more than the organisation holds.
// The existing contract code fits (§13.11.2), so it is a 400 VALIDATION_ERROR
// on `quantity` whose message shows what is available.
export class InsufficientStockError extends ApiError {
  /**
   * @param {number} available The stock's quantityAvailable at that moment.
   * @param {string} unit What it is counted in, e.g. "bottles".
   */
  constructor(available, unit) {
    const message =
      available === 0
        ? `no stock available (0 ${unit})`
        : `must be between 1 and ${available} (available)`;
    super(400, 'VALIDATION_ERROR', 'Request validation failed.', [{ field: 'quantity', message }]);
    this.name = 'InsufficientStockError';
    this.available = available;
  }
}

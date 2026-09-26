// Writes the two response envelopes every endpoint shares, so their shape is
// defined in exactly one place.
export class ApiResponse {
  static success(res, data, status = 200) {
    res.status(status).json({ success: true, data });
  }

  static error(res, status, code, message, errors) {
    res.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(errors && { errors }),
      },
    });
  }
}

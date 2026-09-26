export const sendSuccess = (res, data, status = 200) => {
  res.status(status).json({ success: true, data });
};

export const sendError = (res, status, code, message, errors) => {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(errors && { errors }),
    },
  });
};

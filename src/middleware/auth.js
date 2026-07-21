const verifyExtensionKey = (req, res, next) => {
  const requireKey = process.env.REQUIRE_EXTENSION_KEY === 'true';

  if (!requireKey) {
    return next();
  }

  const apiKey = req.headers['x-extension-key'] || req.query.apiKey;
  const validKey = process.env.API_KEY;

  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Invalid or missing extension API key.',
    });
  }

  next();
};

module.exports = { verifyExtensionKey };

const config = require('./config');
const { sign, verify } = require("jsonwebtoken");

const createToken = (user) => {
  const token = sign(
    { id: user.id },
    config.api.token_key,
    {
      expiresIn: "30 days",
    }
  );

  return token;
};



const validateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "User not Authenticated!" });
  }
  const accessToken = authHeader.split(' ')[1];

  if (!accessToken)
    return res.status(401).json({ error: "User not Authenticated!" });

  try {
    const decoded = verify(accessToken, config.api.token_key);
    if (decoded) {
      req.user_id = decoded.id;
      req.authenticated = true;
      return next();
    } else {
      return next();
    }
  } catch (err) {
    return res.status(401).json({ error: err });
  }
};

module.exports = { createToken, validateToken };
module.exports = {
  api: {
    port: process.env.PORT || 3000,
    token_key: process.env.TOKEN_KEY || '',
  },
  database: {
    user: process.env.DB_USER || '',
    host: process.env.DB_HOST || '',
    database: process.env.DB_NAME || '',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432
  },
  login: {
    client_id: process.env.CLIENT_ID || '',
    client_secret: process.env.CLIENT_SECRET || '',
    redirect_uri: process.env.REDIRECT_URI || '',
  },
};
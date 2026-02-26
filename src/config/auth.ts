import jwksRsa from 'jwks-rsa';

export const azureAdJwksClient = jwksRsa({
  jwksUri: process.env.AZURE_AD_JWKS_URI || '',
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

export const azureB2cJwksClient = jwksRsa({
  jwksUri: process.env.AZURE_B2C_JWKS_URI || '',
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

export const AUTH_CONFIG = {
  azureAd: {
    issuer: process.env.AZURE_AD_ISSUER || '',
    audience: process.env.AZURE_AD_CLIENT_ID || '',
  },
  azureB2c: {
    issuer: process.env.AZURE_B2C_ISSUER || '',
    audience: process.env.AZURE_B2C_CLIENT_ID || '',
  },
};

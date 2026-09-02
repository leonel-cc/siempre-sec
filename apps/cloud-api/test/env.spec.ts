import { validateEnvironment } from '../src/config/env';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://localhost/test',
  OIDC_ISSUER: 'https://issuer.example.com',
  OIDC_AUDIENCE: 'test',
  OIDC_JWKS_URI: 'https://issuer.example.com/jwks',
};

const enabledWhatsApp = {
  WHATSAPP_ENABLED: 'true',
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
  WHATSAPP_AUTH_TEMPLATE_NAME: 'auth',
  WHATSAPP_ALERT_TEMPLATE_NAME: 'alert',
};

describe('phone fingerprint environment policy', () => {
  it('requires a strong fingerprint secret in production', () => {
    expect(() => validateEnvironment({
      ...baseEnvironment,
      ...enabledWhatsApp,
      NODE_ENV: 'production',
    }))
      .toThrow('PHONE_FINGERPRINT_SECRET');
  });

  it('requires the secret whenever WhatsApp is enabled', () => {
    expect(() => validateEnvironment({
      ...baseEnvironment,
      ...enabledWhatsApp,
    })).toThrow('PHONE_FINGERPRINT_SECRET');
  });

  it('accepts a secret of at least 32 characters', () => {
    expect(validateEnvironment({
      ...baseEnvironment,
      ...enabledWhatsApp,
      NODE_ENV: 'production',
      PHONE_FINGERPRINT_SECRET: 'x'.repeat(32),
    }).PHONE_FINGERPRINT_SECRET).toHaveLength(32);
  });

  it('requires WhatsApp to be enabled in production', () => {
    expect(() => validateEnvironment({
      ...baseEnvironment,
      NODE_ENV: 'production',
      WHATSAPP_ENABLED: 'false',
      PHONE_FINGERPRINT_SECRET: 'x'.repeat(32),
    })).toThrow('WHATSAPP_ENABLED must be true in production');
  });
});

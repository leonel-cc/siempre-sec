export interface CloudEnvironment {
  NODE_ENV?: string;
  PORT?: string;
  DATABASE_URL: string;
  OIDC_ISSUER: string;
  OIDC_AUDIENCE: string;
  OIDC_JWKS_URI: string;
  [key: string]: string | undefined;
}

export function validateEnvironment(input: Record<string, unknown>): CloudEnvironment {
  const developmentAuth = input.DEV_AUTH_ENABLED === 'true';
  const developmentWhatsAppDemo = input.NODE_ENV === 'development'
    && typeof input.WHATSAPP_DEMO_TEMPLATE_NAME === 'string'
    && input.WHATSAPP_DEMO_TEMPLATE_NAME.trim() !== '';
  if (developmentAuth && input.NODE_ENV !== 'development') {
    throw new Error('DEV_AUTH_ENABLED requires NODE_ENV=development');
  }
  const required = developmentAuth
    ? ['DATABASE_URL'] as const
    : ['DATABASE_URL', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI'] as const;
  for (const key of required) {
    if (typeof input[key] !== 'string' || input[key].trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const port = input.PORT === undefined ? undefined : String(input.PORT);
  if (port !== undefined && (!/^\d+$/.test(port) || Number(port) > 65535)) {
    throw new Error('PORT must be a valid TCP port');
  }

  for (const key of developmentAuth ? [] : ['OIDC_ISSUER', 'OIDC_JWKS_URI'] as const) {
    try {
      new URL(String(input[key]));
    } catch {
      throw new Error(`${key} must be a valid URL`);
    }
  }

  if (input.NODE_ENV === 'production' && input.WHATSAPP_ENABLED !== 'true') {
    throw new Error('WHATSAPP_ENABLED must be true in production');
  }

  if (input.WHATSAPP_ENABLED === 'true') {
    for (const key of [
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
    ]) {
      if (typeof input[key] !== 'string' || input[key].trim() === '') {
        throw new Error(`Missing required WhatsApp environment variable: ${key}`);
      }
    }
    const demoTemplate = typeof input.WHATSAPP_DEMO_TEMPLATE_NAME === 'string'
      && input.WHATSAPP_DEMO_TEMPLATE_NAME.trim() !== '';
    if (demoTemplate && input.NODE_ENV !== 'development') {
      throw new Error('WHATSAPP_DEMO_TEMPLATE_NAME is allowed only in development');
    }
    if (!demoTemplate) {
      for (const key of ['WHATSAPP_AUTH_TEMPLATE_NAME', 'WHATSAPP_ALERT_TEMPLATE_NAME']) {
        if (typeof input[key] !== 'string' || input[key].trim() === '') {
          throw new Error(`Missing required WhatsApp environment variable: ${key}`);
        }
      }
    }
  }

  if (input.NODE_ENV === 'production'
    || (input.WHATSAPP_ENABLED === 'true' && !developmentWhatsAppDemo)) {
    if (typeof input.PHONE_FINGERPRINT_SECRET !== 'string' || input.PHONE_FINGERPRINT_SECRET.trim().length < 32) {
      throw new Error('PHONE_FINGERPRINT_SECRET must contain at least 32 characters');
    }
  }

  return input as CloudEnvironment;
}

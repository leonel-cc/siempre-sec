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
  const required = ['DATABASE_URL', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI'] as const;
  for (const key of required) {
    if (typeof input[key] !== 'string' || input[key].trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const port = input.PORT === undefined ? undefined : String(input.PORT);
  if (port !== undefined && (!/^\d+$/.test(port) || Number(port) > 65535)) {
    throw new Error('PORT must be a valid TCP port');
  }

  for (const key of ['OIDC_ISSUER', 'OIDC_JWKS_URI'] as const) {
    try {
      new URL(String(input[key]));
    } catch {
      throw new Error(`${key} must be a valid URL`);
    }
  }

  if (input.WHATSAPP_ENABLED === 'true') {
    for (const key of [
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_AUTH_TEMPLATE_NAME',
      'WHATSAPP_ALERT_TEMPLATE_NAME',
    ]) {
      if (typeof input[key] !== 'string' || input[key].trim() === '') {
        throw new Error(`Missing required WhatsApp environment variable: ${key}`);
      }
    }
  }

  return input as CloudEnvironment;
}

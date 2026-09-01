interface AppConfig {
  cloudApiUrl: string;
  oidcAuthority: string;
  oidcClientId: string;
  oidcRedirectUri: string;
  oidcScope: string;
}

const values: AppConfig = {
  cloudApiUrl: import.meta.env.VITE_CLOUD_API_URL?.replace(/\/$/, '') ?? '',
  oidcAuthority: import.meta.env.VITE_OIDC_AUTHORITY?.replace(/\/$/, '') ?? '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? '',
  oidcRedirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI ?? '',
  oidcScope: import.meta.env.VITE_OIDC_SCOPE ?? '',
};

export const configErrors = Object.entries(values)
  .filter(([, value]) => !value.trim())
  .map(([key]) => `Falta configurar ${key}.`);

export const config = values;

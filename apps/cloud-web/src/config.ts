interface AppConfig {
  cloudApiUrl: string;
  developmentAuth: boolean;
  oidcAuthority: string;
  oidcClientId: string;
  oidcRedirectUri: string;
  oidcScope: string;
}

const values: AppConfig = {
  cloudApiUrl: import.meta.env.VITE_CLOUD_API_URL?.replace(/\/$/, '') ?? '',
  developmentAuth: import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH === 'true',
  oidcAuthority: import.meta.env.VITE_OIDC_AUTHORITY?.replace(/\/$/, '') ?? '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? '',
  oidcRedirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI ?? '',
  oidcScope: import.meta.env.VITE_OIDC_SCOPE ?? '',
};

export const configErrors = [
  ...(!values.cloudApiUrl ? ['Falta configurar cloudApiUrl.'] : []),
  ...(!values.developmentAuth
    ? Object.entries({
        oidcAuthority: values.oidcAuthority,
        oidcClientId: values.oidcClientId,
        oidcRedirectUri: values.oidcRedirectUri,
        oidcScope: values.oidcScope,
      }).filter(([, value]) => !value).map(([key]) => `Falta configurar ${key}.`)
    : []),
];

export const config = values;

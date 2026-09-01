import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { config, configErrors } from '../config';

export const userManager = configErrors.length === 0
  ? new UserManager({
      authority: config.oidcAuthority,
      client_id: config.oidcClientId,
      redirect_uri: config.oidcRedirectUri,
      post_logout_redirect_uri: window.location.origin,
      response_type: 'code',
      scope: config.oidcScope,
      automaticSilentRenew: true,
      revokeTokensOnSignout: true,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    })
  : null;

export async function currentAccessToken(): Promise<string | null> {
  return (await userManager?.getUser())?.access_token ?? null;
}

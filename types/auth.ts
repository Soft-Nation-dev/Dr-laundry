export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  requiresEmailConfirmation?: boolean;
};

export type AuthSession = AuthTokens & {
  email: string;
};

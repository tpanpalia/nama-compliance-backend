export const EXTERNAL_USER_ROLES = {
  CONTRACTOR: 'CONTRACTOR',
} as const;

export type ExternalUserRole = (typeof EXTERNAL_USER_ROLES)[keyof typeof EXTERNAL_USER_ROLES];

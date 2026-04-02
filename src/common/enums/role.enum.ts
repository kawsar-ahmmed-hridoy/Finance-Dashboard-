export enum Role {
  VIEWER = 'viewer',
  ANALYST = 'analyst',
  ADMIN = 'admin',
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.VIEWER]: 1,
  [Role.ANALYST]: 2,
  [Role.ADMIN]: 3,
};

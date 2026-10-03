/**
 * Permission catalog. Code checks these keys; ROLES are data (created and edited by admins in the UI)
 * and simply hold a list of these keys plus a camp scope.
 */
export const PERMISSIONS = {
  'camps.view': { group: 'Camps', label: 'View camps, rooms and beds' },
  'camps.manage': { group: 'Camps', label: 'Create, edit and invalidate camps, rooms and beds' },
  'beds.assign': { group: 'Camps', label: 'Assign and move workers between beds' },
  'workers.view': { group: 'Workers', label: 'View workers' },
  'workers.manage': { group: 'Workers', label: 'Add and edit workers' },
  'workers.leave': { group: 'Workers', label: 'Mark workers on leave / returned' },
  'workers.exit': { group: 'Workers', label: 'Exit workers (frees their bed)' },
  'workers.viewIdentity': { group: 'Workers', label: 'See passport and Emirates ID numbers' },
  'workers.export': { group: 'Workers', label: 'Export workers to Excel' },
  'reports.view': { group: 'Reports', label: 'View and export reports' },
  'fields.manage': { group: 'Administration', label: 'Manage custom fields' },
  'org.manage': { group: 'Administration', label: 'Manage sponsors, clients and divisions' },
  'audit.view': { group: 'Administration', label: 'View audit log' },
  'users.manage': { group: 'Administration', label: 'Manage users' },
  'roles.manage': { group: 'Administration', label: 'Manage roles and permissions' },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export const CAMP_SCOPES = ['ALL', 'ASSIGNED'] as const;
export type CampScope = (typeof CAMP_SCOPES)[number];

export interface AccessProfile {
  isSystemAdmin: boolean;
  permissions: readonly string[];
  campScope: CampScope;
  campIds: readonly string[];
}

export function hasPermission(profile: AccessProfile, permission: Permission): boolean {
  return profile.isSystemAdmin || profile.permissions.includes(permission);
}

export function canAccessCamp(profile: AccessProfile, campId: string): boolean {
  if (profile.isSystemAdmin || profile.campScope === 'ALL') return true;
  return profile.campIds.includes(campId);
}

/** Seeded roles. Admins can edit HR/Operations and Camp Supervisor and create new roles; Administrator is locked. */
export const SEED_ROLES: { name: string; description: string; permissions: Permission[]; campScope: CampScope; isSystem: boolean }[] = [
  {
    name: 'Administrator',
    description: 'Full access including users, roles and settings. Cannot be edited.',
    permissions: ALL_PERMISSIONS,
    campScope: 'ALL',
    isSystem: true,
  },
  {
    name: 'HR/Operations',
    description: 'Workers, leave, exits, camps, reports.',
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'users.manage' && p !== 'roles.manage'),
    campScope: 'ALL',
    isSystem: false,
  },
  {
    name: 'Camp Supervisor',
    description: 'Manages only the camps assigned to them.',
    permissions: ['camps.view', 'camps.manage', 'beds.assign', 'workers.view', 'workers.leave'],
    campScope: 'ASSIGNED',
    isSystem: false,
  },
];

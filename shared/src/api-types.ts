/** JSON shapes returned by the backend admin endpoints. Dates are ISO strings. */
import type { FieldType } from './fields.js';
import type { CampScope } from './permissions.js';

export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  campScope: CampScope;
  isSystem: boolean;
  isActive: boolean;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  activeUserCount: number;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roleId: string | null;
  roleName: string | null;
  campScope: CampScope | null;
  campIds: string[];
  createdAt: string;
}

export interface CampOptionDto {
  id: string;
  name: string;
  emirate: string;
  isActive: boolean;
}

export interface CustomFieldDto {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  required: boolean;
  order: number;
  isHidden: boolean;
  /** Workers holding a value. > 0 means the field can no longer be deleted. */
  valueCount: number;
}

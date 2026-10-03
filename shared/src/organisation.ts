import { z } from 'zod';

/** Sponsors (visa entities), client companies and their divisions. Managed by admins; never deleted, only hidden. */
export const orgNameSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1, 'Name is required').max(120)),
});
export const orgHiddenSchema = z.object({ hidden: z.boolean() });

export type OrgKind = 'sponsor' | 'client' | 'division';

export interface OrgItemDto {
  id: string;
  name: string;
  isHidden: boolean;
  workerCount: number;
}

export interface OrgClientDto extends OrgItemDto {
  divisions: OrgItemDto[];
}

export interface OrganisationDto {
  sponsors: OrgItemDto[];
  clients: OrgClientDto[];
}

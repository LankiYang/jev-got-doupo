import { Schema } from "effect";
import { companions, type CompanionId as CatalogCompanionId } from "@/core/data/companions";

export type Companion = (typeof companions)[number];

export const all = companions;

export const byId: Record<CatalogCompanionId, Companion> = Object.fromEntries(
  companions.map((companion) => [companion.id, companion]),
) as Record<CatalogCompanionId, Companion>;

/** Not a catalog member: the honest answer when no recurring face is in the scene. */
export const none = "none" as const;

export const isCompanionId = (value: unknown): value is CatalogCompanionId =>
  typeof value === "string" && Object.hasOwn(byId, value);

export const isCompanionIdOrNone = (value: unknown): value is CatalogCompanionId | typeof none =>
  value === none || isCompanionId(value);

export const CompanionId = Schema.String.pipe(
  Schema.filter(isCompanionIdOrNone, { identifier: "CompanionId" }),
);

export type CompanionId = typeof CompanionId.Type;

export const fallback: CompanionId = none;

export const nameOf = (id: CompanionId): string => (id === none ? "" : byId[id].name);

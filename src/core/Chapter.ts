import { Option, Schema } from "effect";
import { chapters, type ChapterId as CatalogChapterId } from "@/core/data/chapters";

export type Chapter = (typeof chapters)[number];

export const all = chapters;

export const byId: Record<CatalogChapterId, Chapter> = Object.fromEntries(
  chapters.map((chapter) => [chapter.id, chapter]),
) as Record<CatalogChapterId, Chapter>;

export const isChapterId = (value: unknown): value is CatalogChapterId =>
  typeof value === "string" && Object.hasOwn(byId, value);

export const ChapterId = Schema.String.pipe(
  Schema.filter(isChapterId, { identifier: "ChapterId" }),
);

export type ChapterId = typeof ChapterId.Type;

/** Where a new story, or a replayed one with no chapter on record, opens. */
export const fallback: ChapterId = chapters[0].id;

/** A stored id is a total read: one from before this build's catalog existed, or from a
 *  chapter this build has since dropped, falls back rather than throwing. */
export const resolve = (id: unknown): ChapterId => (isChapterId(id) ? id : fallback);

/** A chapter needs at least this many turns before 合 is allowed to close it — guards
 *  against one generous reading skipping the arc the chapter was meant to run. */
export const minTurns = 3;

export const indexOf = (id: ChapterId): number => chapters.findIndex((chapter) => chapter.id === id);

export const goalOf = (id: ChapterId): string => byId[id].goal;

/** The chapter after this one, or `None` once the story has reached the last one. */
export const next = (id: ChapterId): Option.Option<ChapterId> => {
  const chapter = chapters[indexOf(id) + 1];
  return chapter === undefined ? Option.none() : Option.some(chapter.id);
};

import { describe, expect, it } from "vitest";
import * as ArcStage from "@/core/ArcStage";
import * as Beat from "@/core/Beat";
import * as Companion from "@/core/Companion";
import * as Danger from "@/core/Danger";
import * as Mood from "@/core/Mood";
import { ARC_STAGES, BEATS, COMPANIONS, DANGERS, MOODS, trackFor } from "@/components/api";

/**
 * The browser keeps its own hand-written copy of the label lists, so the catalogs and
 * their lore stay out of the bundle. A label the client has never heard of fails its
 * guard silently: the header stops showing that row, and a new mood never reaches the
 * soundtrack. Nothing else catches that, so this does.
 */
describe("the client's label lists", () => {
  it("mirrors the mood catalog exactly", () => {
    expect([...MOODS]).toEqual(Mood.all.map((mood) => mood.id));
  });

  it("mirrors the beat catalog exactly", () => {
    expect([...BEATS]).toEqual(Beat.all.map((beat) => beat.id));
  });

  it("mirrors the danger rubric exactly", () => {
    expect([...DANGERS]).toEqual(Danger.levels.map((level) => level.id));
  });

  it("mirrors the arc stage rubric exactly", () => {
    expect([...ARC_STAGES]).toEqual(ArcStage.levels.map((level) => level.id));
  });

  it("mirrors the companion catalog exactly", () => {
    expect([...COMPANIONS]).toEqual(Companion.all.map((companion) => companion.id));
  });

  it("points at the same track the catalog does", () => {
    expect(MOODS.map(trackFor)).toEqual(Mood.all.map((mood) => Mood.trackFor(mood.id)));
  });
});

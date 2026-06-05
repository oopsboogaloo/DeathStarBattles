export const RIFT_SEGMENT_LENGTH     = 10;    // ≈ 1 Medium station diameter (game units)
export const RIFT_REPULSION_STRENGTH = 0.0015; // force per vertex at d=0 (tunable)

export class SpaceRift {
  constructor({ vertices }) {
    this.vertices        = vertices; // Vec2[], length = N+1 where N = segment count
    this.influenceRadius = (vertices.length - 1) * RIFT_SEGMENT_LENGTH;
  }
}

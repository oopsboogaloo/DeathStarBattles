export class Vec2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  add(v)       { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v)       { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s)     { return new Vec2(this.x * s, this.y * s); }
  dot(v)       { return this.x * v.x + this.y * v.y; }
  magnitude()  { return Math.sqrt(this.x * this.x + this.y * this.y); }

  normalised() {
    const m = this.magnitude();
    return m === 0 ? new Vec2(0, 0) : this.scale(1 / m);
  }

  distanceTo(v) {
    return this.sub(v).magnitude();
  }

  distanceSqTo(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  angle() { return Math.atan2(this.y, this.x); }

  toString() { return `Vec2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`; }
}

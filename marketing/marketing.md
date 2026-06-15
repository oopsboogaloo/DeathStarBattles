# DeathStarBattles — Marketing Copy

**Itch.io:** https://spacemammoth.itch.io/death-star-battles

---

## Itch.io Description

A turn-based gravity warfare game. Two space stations. One solar system full of planets pulling your shots off course. Fire, watch your bullet arc through the gravitational field, and hope you calculated better than your opponent.

Every shot is a physics puzzle. Planets bend trajectories, wormholes teleport bullets mid-flight, and the terrain changes across 38 hand-crafted scenarios. You can eyeball it, use the aim indicator, or study the ghost trails left by your previous shots to dial in your angle.

**Features**
- 38 scenarios ranging from simple duels to chaotic multi-planet mazes
- Up to 12 players in a single match — any mix of human and AI
- 6 weapons — blaster, triple cannon, blunderbuss, minigun, laser, and rockets
- 5 AI difficulty levels, from random to a bot that simulates thousands of trajectories per turn
- Wormholes that teleport bullets and shorten their remaining lifetime each pass
- Irregular asteroid bodies with real polygon collision
- 20-mission story campaign
- Tournament mode and kill leaderboard
- Optional bullet path preview and ghost trails to help you learn the physics
- Runs entirely in the browser — no install, no login

*DeathStarBattles has been evolving since 1992, when the first version spread around a college campus on photocopied calculator code. This is the version it always wanted to be.*

---

## Reddit Posts

### Launch post (r/itchio, r/WebGames)

**Title:** Just launched DeathStarBattles on itch.io — gravity warfare game 34 years in the making

Just published DeathStarBattles on itch. Turn-based gravity warfare — fire bullets across a solar system, let the planets bend your shots, try to hit the enemy station before they hit you.

Been making versions of this since 1992 (started on graphical calculators, spread around college on photocopied code). The HTML5 remake has 38 scenarios, up to 12 players, six weapons, wormholes, and a story campaign. Runs in the browser, free to play.

https://spacemammoth.itch.io/death-star-battles

Would love any feedback — and if anyone knows why newly published itch games don't show up in search, I'm all ears.

---

### Origin story post (r/gamedev, r/indiegaming, r/programming)

**Title:** 34 years ago I wrote a gravity warfare game for graphical calculators. Here's where it ended up.

In 1992, I was obsessed with Gravity Wars on the PC and Amiga — that turn-based game where you fire bullets across a solar system and gravity does the rest. So I made my own version for graphical calculators.

It spread around college the old-fashioned way: photocopying. People would hand each other sheets of code to type into their own calculators. That was my first taste of something I'd made going viral.

Fast forward to university. Instead of writing up my thesis, I built **DeathStarBattles** as a Java applet. It was 2001 — there wasn't much to do on the internet back then — and it quietly hit 100,000+ visitors a month. I know because the university IT department complained to my supervisor about the bandwidth. That Java applet was also my introduction to object-oriented programming. The code is genuinely bad. It was enough to get me started in the software industry, which I'll take.

Over the years I've kept returning to this game as a way to keep skills sharp. I built **Mammoth Gravity Battles**, a 3D mobile-enabled version. And now I've finally done the port I always wanted: a full HTML5/JS remake with all the features I never had time to add back in 2001.

- 38 scenarios with proper gravity physics
- Up to 12 players — any mix of human and AI
- 6 weapons: blaster, triple cannon, blunderbuss, minigun, laser, rockets
- An AI that runs full trajectory simulations to find the best shot
- Wormholes, irregular asteroids, a 20-mission story campaign
- Runs in the browser, no install

https://spacemammoth.itch.io/death-star-battles

Thirty-four years from a photocopied calculator program to this. Funny how some projects just stick with you.

---

### Physics subreddit post (r/PhysicsGames)

**Title:** Built a gravity warfare game where every shot is a physics problem

DeathStarBattles is a turn-based game where two space stations trade fire across a solar system. There's no shooting straight — every bullet travels under the gravitational influence of every planet on the map, so landing a hit means solving an orbital mechanics puzzle in your head.

Under the hood it's semi-implicit Euler integration, running per-bullet per-tick. The hardest AI level works the same way the player does: it samples thousands of candidate angles, simulates each trajectory in full, and picks the best one. On maps with wormholes it gets especially interesting — bullets teleport and come out on a different heading, which the AI has to account for.

I've been building versions of this game since 1992 (originally on graphical calculators). The HTML5 remake adds rockets with thrust-then-coast arcs, a laser that traces a straight path but still has to avoid planets, and irregular asteroid bodies using rotating convex polygons with SAT collision.

https://spacemammoth.itch.io/death-star-battles

Runs in the browser, no install. Happy to go deep on any of the physics or AI if anyone's curious.

---

## The Story (long form)

In 1992 I played Gravity Wars on the PC and Amiga. You fired bullets across a solar system, planets bent them off course with gravity, and you tried to hit your opponent's base before they hit yours. It was simple, clever, and immediately addictive.

I was at college. I didn't have a PC. But I did have a graphical calculator.

So I wrote my own version for it. No internet to share it on, no app store — just photocopied sheets of code that passed from hand to hand around the campus. People would sit there typing it in by hand. That was my first experience of making something that spread on its own. I was hooked.

---

Years later I was at university, supposedly writing my thesis. Instead I built **DeathStarBattles** as a Java applet. It was 2001. The web was young and there wasn't much to do on it, and the game quietly grew to over 100,000 visitors a month. I know this because the university IT department complained to my supervisor about the bandwidth.

Writing that applet also taught me object-oriented programming for the first time. The code is, by any objective measure, not good. But it was good enough to help me land my first job in software development. I owe a lot to that terrible codebase.

---

Over the years I've kept coming back to the game. There's something about gravity warfare that never gets old — the way a good shot feels when you've correctly predicted how the planets will bend it, the anguish of watching a perfectly aimed bullet drift just wide. I built **Mammoth Gravity Battles**, a 3D mobile version, to keep my skills sharp.

---

Recently I did the port I always wanted to do: a full HTML5 and JavaScript remake of DeathStarBattles, built properly this time, with all the features I could never add in 2001.

38 scenarios. Up to 12 players. Six weapons — blasters, triple cannons, blunderbusses, miniguns, lasers, rockets. An AI that actually simulates thousands of trajectories before taking its shot. Wormholes. A 20-mission story campaign. Tournament mode.

https://spacemammoth.itch.io/death-star-battles

Thirty-four years from a photocopied calculator program to this. Some projects just stick with you.

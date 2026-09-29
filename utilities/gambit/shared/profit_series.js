// Serija kumulativnog profita za live grafikon (čisto): x = pravi redni broj kruga, decimacija na pola iznad limita,
// prva i najnovija tačka se uvek čuvaju (ZAKON virtuelizacije: ne držati bezbroj tačaka u DOM/canvas-u).
export function createSeries(maxPoints = 4000) {
  const s = { xs: [0], ys: [0], _round: 0 };
  s.push = (cumProfit) => {
    s._round += 1;
    s.xs.push(s._round);
    s.ys.push(cumProfit);
    if (s.xs.length > maxPoints) {
      const nx = [s.xs[0]];
      const ny = [s.ys[0]];
      const last = s.xs.length - 1;
      for (let i = 1; i < last; i += 2) { nx.push(s.xs[i]); ny.push(s.ys[i]); }
      nx.push(s.xs[last]);
      ny.push(s.ys[last]);
      s.xs = nx;
      s.ys = ny;
    }
  };
  s.reset = () => { s.xs = [0]; s.ys = [0]; s._round = 0; };
  s.size = () => s.xs.length;
  s.rounds = () => s._round;
  return s;
}

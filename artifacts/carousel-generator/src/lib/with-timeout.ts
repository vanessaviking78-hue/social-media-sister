// A post that hangs while it is drawn or uploaded must not freeze the whole bulk run. After the wait it fails and the run moves on.
export function withTimeout<T>(p: Promise<T>, ms = 90000, what = "That post"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} took too long, so I skipped it`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

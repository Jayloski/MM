/**
 * Agglomerative hierarchical clustering (average linkage) on a correlation matrix.
 * Distance metric: d = 1 - |r|  (0 = identical, 1 = uncorrelated)
 */

export const NUM_CLUSTERS = 6;

export const CLUSTER_COLORS: string[] = [
  '#e879f9', // fuchsia-400
  '#22d3ee', // cyan-400
  '#a3e635', // lime-400
  '#fb923c', // orange-400
  '#818cf8', // indigo-400
  '#2dd4bf', // teal-400
];

export const CLUSTER_LABELS: string[] = [
  'Cluster A',
  'Cluster B',
  'Cluster C',
  'Cluster D',
  'Cluster E',
  'Cluster F',
];

/**
 * Returns an array of length n where each entry is a cluster id 0..k-1.
 * Tickers with no valid correlations end up in cluster 0.
 */
export function clusterTickers(
  n: number,
  matrix: (number | null)[][],
  k = NUM_CLUSTERS,
): number[] {
  if (n === 0) return [];
  const clampedK = Math.min(k, n);

  // distance between individual nodes
  const dist = (i: number, j: number): number => {
    const r = matrix[i]?.[j];
    return r == null ? 0.5 : 1 - Math.abs(r);
  };

  // clusters: each is a list of node indices
  let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);

  while (clusters.length > clampedK) {
    let minDist = Infinity;
    let mergeA = 0;
    let mergeB = 1;

    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        // average linkage: mean distance between all pairs across the two clusters
        let sum = 0;
        let count = 0;
        for (const i of clusters[a]) {
          for (const j of clusters[b]) {
            sum += dist(i, j);
            count++;
          }
        }
        const avg = count > 0 ? sum / count : 1;
        if (avg < minDist) {
          minDist = avg;
          mergeA = a;
          mergeB = b;
        }
      }
    }

    clusters[mergeA] = [...clusters[mergeA], ...clusters[mergeB]];
    clusters.splice(mergeB, 1);
  }

  const assignment = new Array<number>(n).fill(0);
  clusters.forEach((members, cIdx) => {
    members.forEach(nodeIdx => {
      assignment[nodeIdx] = cIdx;
    });
  });
  return assignment;
}

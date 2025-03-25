import { BASE_NODE_PORT } from "../config";

export async function startConsensus(N: number) {
  const promises = [];
  for (let index = 0; index < N; index++) {
    promises.push(
        fetch(`http://localhost:${BASE_NODE_PORT + index}/start`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }).catch((e) => console.error(`Error starting node ${index}:`, e))
    );
  }
  await Promise.all(promises);
}

export async function stopConsensus(N: number) {
  const promises = [];
  for (let index = 0; index < N; index++) {
    promises.push(
        fetch(`http://localhost:${BASE_NODE_PORT + index}/stop`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        }).catch((e) => console.error(`Error stopping node ${index}:`, e))
    );
  }
  await Promise.all(promises);
}
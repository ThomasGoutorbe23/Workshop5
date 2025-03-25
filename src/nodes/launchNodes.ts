import { Value } from "../types";
import { node } from "./node";

export async function launchNodes(
    N: number,
    F: number,
    initialValues: Value[],
    faultyList: boolean[]
) {
  if (initialValues.length !== faultyList.length || N !== initialValues.length)
    throw new Error("Arrays don't match");
  if (faultyList.filter((el) => el === true).length !== F)
    throw new Error("faultyList doesn't have F faulties");

  const promises = [];
  const nodesStates = new Array(N).fill(false);

  function nodesAreReady() {
    return nodesStates.every((el) => el === true);
  }

  function setNodeIsReady(index: number) {
    nodesStates[index] = true;
  }

  // start nodes
  for (let index = 0; index < N; index++) {
    promises.push(
        node(
            index,
            N,
            F,
            initialValues[index],
            faultyList[index],
            nodesAreReady,
            setNodeIsReady
        )
    );
  }

  const servers = await Promise.all(promises);

  // wait for nodes to be readyy
  let attempts = 0;
  while (!nodesAreReady() && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!nodesAreReady()) {
    console.warn("Some nodes did not become ready in time");
  }

  return servers;
}
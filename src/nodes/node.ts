import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value, NodeState } from "../types";

export async function node(
    nodeId: number,
    N: number,
    F: number,
    initialValue: Value,
    isFaulty: boolean,
    nodesAreReady: () => boolean,
    setNodeIsReady: (index: number) => void
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  let currentState: NodeState = {
    killed: false,
    x: isFaulty ? null : initialValue,
    decided: isFaulty ? null : false,
    k: isFaulty ? null : 0,
  };

  let proposals: Map<number, Value[]> = new Map();
  let votes: Map<number, Value[]> = new Map();

  // Get node status
  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  });

  // Receive messge
  node.post("/message", (req, res) => {
    if (currentState.killed || isFaulty) {
      res.status(400).send("Node is faulty or stopped");
      return;
    }

    const { k, x, messageType } = req.body;

    if (messageType === "propose") {
      if (!proposals.has(k)) {
        proposals.set(k, []);
      }
      proposals.get(k)!.push(x);
    } else if (messageType === "vote") {
      if (!votes.has(k)) {
        votes.set(k, []);
      }
      votes.get(k)!.push(x);
    }

    res.status(200).send("success");
  });

  // start
  node.get("/start", async (req, res) => {
    if (isFaulty || currentState.killed) {
      res.status(400).send("Node is faulty or stopped");
      return;
    }

    //
    while (!nodesAreReady()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    while (!currentState.decided) {
      if (currentState.k === null) currentState.k = 0;
      currentState.k++;


      const proposal = currentState.x;
      await Promise.all(
          Array.from({ length: N }, (_, i) =>
              fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  k: currentState.k,
                  x: proposal,
                  messageType: "propose",
                }),
              }).catch(() => {})
          ));

      await new Promise(resolve => setTimeout(resolve, 100));


      const currentProposals = proposals.get(currentState.k) || [];
      const proposalCounts = currentProposals.reduce(
          (acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
          },
          {} as Record<Value, number>
      );

      let newX: Value | null = null;
      for (const [val, count] of Object.entries(proposalCounts)) {
        if (count > N / 2) {
          newX = parseInt(val) as Value;
          break;
        }
      }

      const vote = newX !== null ? newX : Math.random() > 0.5 ? 1 : 0;
      await Promise.all(
          Array.from({ length: N }, (_, i) =>
              fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  k: currentState.k,
                  x: vote,
                  messageType: "vote",
                }),
              }).catch(() => {})
          ));

      await new Promise(resolve => setTimeout(resolve, 100));

      const currentVotes = votes.get(currentState.k) || [];
      const voteCounts = currentVotes.reduce(
          (acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
          },
          {} as Record<Value, number>
      );

      for (const [val, count] of Object.entries(voteCounts)) {
        if (count >= N - F) {
          currentState.x = parseInt(val) as Value;
          currentState.decided = true;
          break;
        }
      }
    }

    res.status(200).send("Consensus reached");
  });

  // stop node
  node.get("/stop", async (req, res) => {
    currentState.killed = true;
    res.status(200).send("Node stopped");
  });

  // get actual status
  node.get("/getState", (req, res) => {
    res.status(200).json(currentState);
  });

  // start server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(`Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`);
    setNodeIsReady(nodeId);
  });

  async function sendWithRetry(url: string, body: any, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3000)
        });
        if (response.ok) return;
      } catch (e) {
        if (i === retries - 1) console.error(`Failed to send to ${url}:`, e);
      }
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }

  return server;
}
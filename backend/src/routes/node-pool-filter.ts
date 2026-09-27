import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { nodePoolEntriesCol } from "../lib/db.js";
import { getNodePoolMeta } from "../lib/node-pool.js";
import { acquireNodePoolOperationLock, releaseNodePoolOperationLock } from "../lib/node-pool-operation-lock.js";
import { requireAdmin } from "../middleware/require-role.js";
import { publishNodePool } from "../services/node-pool-publisher.js";

const router = Router();

const filterSchema = z.object({
  nodeIds: z.array(z.string()).min(1)
});

router.get("/admin/node-pool-nodes", requireAdmin, async (_req, res) => {
  const entries = await nodePoolEntriesCol()
    .find({}, {
      projection: {
        upstream_id: 1,
        upstream_name: 1,
        node_name: 1,
        protocol: 1,
        selected: 1,
        upstream_order: 1,
        node_order: 1
      }
    })
    .sort({ upstream_order: 1, node_order: 1 })
    .toArray();
  const [mongoTotal, mongoSelected, redisMeta] = await Promise.all([
    nodePoolEntriesCol().countDocuments({}),
    nodePoolEntriesCol().countDocuments({ selected: true }),
    getNodePoolMeta()
  ]);

  const groups: Array<{
    upstream: { id: string; name: string };
    nodes: Array<{ id: string; name: string; protocol: string; selected: boolean }>;
  }> = [];
  const groupsByUpstream = new Map<string, (typeof groups)[number]>();

  for (const entry of entries) {
    const upstreamId = entry.upstream_id.toHexString();
    let group = groupsByUpstream.get(upstreamId);
    if (!group) {
      group = {
        upstream: { id: upstreamId, name: entry.upstream_name },
        nodes: []
      };
      groupsByUpstream.set(upstreamId, group);
      groups.push(group);
    }
    group.nodes.push({
      id: entry._id!.toHexString(),
      name: entry.node_name,
      protocol: entry.protocol,
      selected: entry.selected
    });
  }

  return res.json({
    groups,
    counts: {
      mongoTotal,
      mongoSelected,
      redisActive: redisMeta?.nodeCount || 0
    }
  });
});

router.post("/admin/node-pool/filter", requireAdmin, async (req, res) => {
  const parsed = filterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "nodeIds must contain at least one node id" });
  }
  if (parsed.data.nodeIds.some((id) => !/^[a-f\d]{24}$/iu.test(id) || !ObjectId.isValid(id))) {
    return res.status(400).json({ message: "Invalid node id" });
  }

  const uniqueIds = [...new Set(parsed.data.nodeIds.map((id) => new ObjectId(id).toHexString()))];
  const objectIds = uniqueIds.map((id) => new ObjectId(id));
  const existingCount = await nodePoolEntriesCol().countDocuments({ _id: { $in: objectIds } });
  if (existingCount !== objectIds.length) {
    return res.status(400).json({ message: "One or more node ids do not exist" });
  }

  const lockToken = await acquireNodePoolOperationLock("filter");
  if (!lockToken) {
    return res.status(409).json({ message: "node pool operation already running" });
  }

  try {
    const lockedExistingCount = await nodePoolEntriesCol().countDocuments({ _id: { $in: objectIds } });
    if (lockedExistingCount !== objectIds.length) {
      return res.status(409).json({ message: "node pool changed; reload and try again" });
    }

    await nodePoolEntriesCol().updateMany(
      {},
      [{ $set: { selected: { $in: ["$_id", objectIds] } } }]
    );

    const selectedEntries = await nodePoolEntriesCol()
      .find({ selected: true }, { projection: { uri: 1, upstream_order: 1, node_order: 1 } })
      .sort({ upstream_order: 1, node_order: 1 })
      .toArray();
    const selectedNodeText = selectedEntries.map((entry) => entry.uri).join("\n");
    const published = await publishNodePool(selectedNodeText);
    const mongoTotal = await nodePoolEntriesCol().countDocuments({});

    return res.json({
      mongoTotal,
      selectedCount: selectedEntries.length,
      redisActive: published.hydrated.nodeCount,
      version: published.toVersion.version
    });
  } catch (error) {
    console.error("node pool filter publish failed", {
      error: error instanceof Error ? error.message : "unknown error"
    });
    return res.status(500).json({ message: "node pool filter publish failed" });
  } finally {
    await releaseNodePoolOperationLock(lockToken);
  }
});

export default router;

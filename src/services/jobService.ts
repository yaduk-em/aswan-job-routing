import { authenticatePB } from "@/lib/pocketbase";
import { PB_CONFIG } from "@/config/pocketbase";

interface SubIdEntry {
  subId: string;
  quantity: number;
}

interface JobCreationInput {
  workOrderNumber: string;
  subIdEntries: SubIdEntry[];
}

interface CreationResult {
  totalJobs: number;
  totalRoutes: number;
  totalMachines: number;
  errors: string[];
}

export async function createJobEntries(
  input: JobCreationInput
): Promise<CreationResult> {
  const pb = await authenticatePB();
  const { collections, operations } = PB_CONFIG;

  const result: CreationResult = {
    totalJobs: 0,
    totalRoutes: 0,
    totalMachines: 0,
    errors: [],
  };

  // Pre-fetch machine records for all operations
  const machineRecordMap: Record<string, string> = {};
  for (const op of operations) {
    try {
      const machines = await pb
        .collection(collections.machineMaster)
        .getList(1, 1, { filter: `machineId="${op.machineId}"` });
      if (machines.items.length > 0) {
        machineRecordMap[op.machineId] = machines.items[0].id;
      }
    } catch (e) {
      result.errors.push(
        `Warning: Could not find machine "${op.machineId}" in machineMaster`
      );
    }
  }

  for (const entry of input.subIdEntries) {
    const { subId, quantity } = entry;

    // Create individual job entries (1 qty each)
    for (let q = 1; q <= quantity; q++) {
      const displayName = `${input.workOrderNumber}-${subId} (${q}/${quantity})`;

      try {
        // Step 1: Create job in ASWNDUBAI_Job
        const jobRecord = await pb.collection(collections.job).create({
          workOrderNumber: input.workOrderNumber,
          subId: String(subId),
          jobQty: "1",
          displayName,
        });
        result.totalJobs++;

        // Step 2: Create 5 operation routes for this job
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];
          const isLast = i === operations.length - 1;
          const prevSeq = i > 0 ? operations[i - 1].sequence : "";
          const nextSeq = i < operations.length - 1 ? operations[i + 1].sequence : "";

          try {
            const routeRecord = await pb
              .collection(collections.jobProductReceipeRoutes)
              .create({
                operationName: op.name,
                sequence: op.sequence,
                previousSequence: prevSeq,
                nextSequence: nextSeq,
                jobId: jobRecord.id,
                isCompleted: false,
                isLastOperation: isLast,
                status: "",
                runHrsPer: String(Math.floor(Math.random() * 10) + 1),
              });
            result.totalRoutes++;

            // Step 3: Create machine entry for this route
            const cycleTime = String(Math.floor(Math.random() * 11)); // 0-10
            const machineRefId = machineRecordMap[op.machineId] || "";

            try {
              await pb.collection(collections.receipeRouteMachines).create({
                jobreceipeId: routeRecord.id,
                machine: machineRefId || undefined,
                machineId: op.machineId,
                cycleTime,
                isRunning: false,
                isPriority: false,
              });
              result.totalMachines++;
            } catch (e: any) {
              result.errors.push(
                `Machine entry error for ${displayName} / ${op.name}: ${e.message}`
              );
            }
          } catch (e: any) {
            result.errors.push(
              `Route error for ${displayName} / ${op.name}: ${e.message}`
            );
          }
        }
      } catch (e: any) {
        result.errors.push(`Job creation error for ${displayName}: ${e.message}`);
      }
    }
  }

  return result;
}

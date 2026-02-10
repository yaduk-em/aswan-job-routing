import { authenticatePB } from "@/lib/pocketbase";
import { PB_CONFIG } from "@/config/pocketbase";

interface SubIdEntry {
  subId: string;
  quantity: number;
}

interface JobCreationInput {
  workOrderNumber: string;
  subIdEntries: SubIdEntry[];
  custOrderId: string;
  custOrderLineNo: number;
}

interface CreationResult {
  totalJobs: number;
  totalRoutes: number;
  totalMachines: number;
  totalConsolidateEntries: number;
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
    totalConsolidateEntries: 0,
    errors: [],
  };

  // Step 0: Create erpConsolidateData entries (one per subId)
  const today = new Date().toISOString();
  for (const entry of input.subIdEntries) {
    try {
      await pb.collection(collections.erpConsolidateData).create({
        TXN_TYPE: "WO",
        CUST_ORDER_ID: input.custOrderId,
        CUST_ORDER_LINE_NO: input.custOrderLineNo,
        BOM_WORKORDER_BASE_ID: input.workOrderNumber,
        BOM_WORKORDER_SUB_ID: String(entry.subId),
        CUST_ORDER_DATE: today,
        CUST_ORDER_WANT_DATE: "",
        CUST_ORDER_LINE_WANT_DATE: "",
        BOM_PART_ID: "",
        CUST_ORDER_STATUS: "Open",
        WO_ASSMB_PART_ID: "",
        WO_ASSMB_QTY: entry.quantity,
        WO_CREATE_DATE: today,
        WO_RLS_DATE: "",
        WO_WANT_DATE: "",
        WO_STATUS: "Created",
        WO_PRODUCT_CODE: "",
        WO_ASW_STATUS: "",
        BOM_WORKORDER_TYPE: "",
        BOM_WORKORDER_LOT_ID: "",
        BOM_QTY: entry.quantity,
        BOM_WORKORDER_SPLIT_ID: "",
        BOM_OPERATION_SEQ_NO: 0,
        BOM_PIECE_NO: 0,
        PART_IS_MANUFACTURE: "",
        PART_CATEGORY: "",
      });
      result.totalConsolidateEntries++;
    } catch (e: any) {
      result.errors.push(
        `ERP Consolidate error for ${input.workOrderNumber}-${entry.subId}: ${e.message}`
      );
    }
  }

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

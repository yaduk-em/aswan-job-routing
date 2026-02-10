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

interface DeleteResult {
  deletedJobs: number;
  deletedRoutes: number;
  deletedMachines: number;
  deletedConsolidateEntries: number;
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
        // Transaction info
        TXN_TYPE: "BOM",
        // Customer order info
        CUST_ORDER_ID: input.custOrderId,
        CUST_ORDER_LINE_NO: input.custOrderLineNo,
        CUST_ORDER_DATE: today,
        CUST_ORDER_WANT_DATE: today,
        CUST_ORDER_LINE_WANT_DATE: today,
        CUST_ORDER_STATUS: "Open",
        // Work order / BOM info
        BOM_WORKORDER_BASE_ID: input.workOrderNumber,
        BOM_WORKORDER_SUB_ID: String(entry.subId),
        BOM_WORKORDER_TYPE: "Standard",
        BOM_WORKORDER_LOT_ID: `LOT-${input.workOrderNumber}-${entry.subId}`,
        BOM_WORKORDER_SPLIT_ID: "0",
        BOM_PART_ID: `PART-${input.workOrderNumber}-${entry.subId}`,
        BOM_QTY: entry.quantity,
        BOM_OPERATION_SEQ_NO: 10,
        BOM_PIECE_NO: Number(entry.subId),
        // Work order assembly & status
        WO_ASSMB_PART_ID: `ASSY-${input.workOrderNumber}-${entry.subId}`,
        WO_ASSMB_QTY: entry.quantity,
        WO_CREATE_DATE: today,
        WO_RLS_DATE: today,
        WO_WANT_DATE: today,
        WO_STATUS: "Created",
        WO_PRODUCT_CODE: `PROD-${input.custOrderId}`,
        WO_ASW_STATUS: "Pending",
        // Part info
        PART_IS_MANUFACTURE: "Y",
        PART_CATEGORY: "Manufactured",
        // Purchase requisition (defaults)
        PURC_REQ_ID: "",
        PURC_REQ_LINE_NO: 0,
        PURC_REQ_PART_ID: "",
        PURC_REQ_QTY: 0,
        PURC_REQ_DATE: today,
        PURC_REQ_WANT_DATE: today,
        // Purchase order (defaults)
        PURC_ORDER_ID: "",
        PO_LINE_NO: 0,
        PO_QTY: 0,
        PURC_ORDER_DATE: today,
        PURC_ORDER_STATUS: "",
        PO_WANT_DATE: today,
        PO_ETD: today,
        PO_ETA: today,
        // GRN (defaults)
        GRN_ID: "",
        GRN_LINE_NO: 0,
        GRN_QTY: 0,
        GRN_INSPECT_QTY: 0,
        GRN_REJECTED_QTY: 0,
        GRN_DATE: today,
        GRN_CREATE_DATE: today,
        // Inventory transaction (defaults)
        INV_TRANS_ID: 0,
        INV_TRANS_PART_ID: "",
        INV_TRANS_TYPE: "",
        INV_TRANS_CLASS: "",
        INV_TRANS_QTY: 0,
        INV_TRANS_DATE: today,
        INV_TRANS_CREATE_DATE: today,
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
          // Product info
          productCode: `PROD-${input.workOrderNumber}-${subId}`,
          productDescription: `Product for ${input.workOrderNumber}-${subId}`,
          productType: "Standard",
          partId: `PART-${input.workOrderNumber}-${subId}`,
          // Dates
          creationDate: today,
          lastUpdateDate: today,
          orderStartDate: today,
          orderEndDate: today,
          salesOrderCreationDate: today,
          preferedDeliveryDate: today,
          syncTimestamp: new Date(),
          jobCompletionDate: null,
          // Sales order info (from input)
          salesOrderNumber: input.custOrderId,
          soLineNumber: String(input.custOrderLineNo),
          salesOrderLineNumber: String(input.custOrderLineNo),
          salesOrderQuantity: String(quantity),
          // Customer info
          customerName: `Customer-${input.custOrderId}`,
          customerNumber: `CUST-${input.custOrderId}`,
          // Status fields
          jobStatus: "Created",
          isInProgress: false,
          isCompleted: false,
          syncStatus: "Pending",
          // Additional fields
          drawingTag: "",
          serialNumber: "",
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

export async function deleteWorkOrderEntries(
  workOrderNumber: string
): Promise<DeleteResult> {
  const pb = await authenticatePB();
  const { collections } = PB_CONFIG;

  const result: DeleteResult = {
    deletedJobs: 0,
    deletedRoutes: 0,
    deletedMachines: 0,
    deletedConsolidateEntries: 0,
    errors: [],
  };

  try {
    // 1. Delete erpConsolidateData entries
    const erpRecords = await pb
      .collection(collections.erpConsolidateData)
      .getFullList({ filter: `BOM_WORKORDER_BASE_ID="${workOrderNumber}"` });
    for (const rec of erpRecords) {
      try {
        await pb.collection(collections.erpConsolidateData).delete(rec.id);
        result.deletedConsolidateEntries++;
      } catch (e: any) {
        result.errors.push(`Delete ERP entry ${rec.id}: ${e.message}`);
      }
    }

    // 2. Find all jobs for this work order
    const jobRecords = await pb
      .collection(collections.job)
      .getFullList({ filter: `workOrderNumber="${workOrderNumber}"` });

    for (const job of jobRecords) {
      // 3. Find routes for this job
      const routes = await pb
        .collection(collections.jobProductReceipeRoutes)
        .getFullList({ filter: `jobId="${job.id}"` });

      for (const route of routes) {
        // 4. Delete machines for this route
        const machines = await pb
          .collection(collections.receipeRouteMachines)
          .getFullList({ filter: `jobreceipeId="${route.id}"` });
        for (const machine of machines) {
          try {
            await pb.collection(collections.receipeRouteMachines).delete(machine.id);
            result.deletedMachines++;
          } catch (e: any) {
            result.errors.push(`Delete machine ${machine.id}: ${e.message}`);
          }
        }

        // Delete route
        try {
          await pb.collection(collections.jobProductReceipeRoutes).delete(route.id);
          result.deletedRoutes++;
        } catch (e: any) {
          result.errors.push(`Delete route ${route.id}: ${e.message}`);
        }
      }

      // Delete job
      try {
        await pb.collection(collections.job).delete(job.id);
        result.deletedJobs++;
      } catch (e: any) {
        result.errors.push(`Delete job ${job.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    result.errors.push(`Delete operation failed: ${e.message}`);
  }

  return result;
}

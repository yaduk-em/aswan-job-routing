import { authenticatePB } from "@/lib/pocketbase";
import { PB_CONFIG } from "@/config/pocketbase";

interface SubIdEntry {
  subId: string;
  quantity: number;
}

// Helper functions for random value generation
function randomFromArray<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomString(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateISO(date: Date): string {
  return date.toISOString();
}

interface JobCreationInput {
  workOrderNumber: string;
  subIdEntries: SubIdEntry[];
  custOrderId: string;
  custOrderLineNo: number;
  custOrderWantDate: string;
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
  const today = new Date();
  const todayISO = formatDateISO(today);
  const custOrderWantDate = new Date(input.custOrderWantDate);
  
  // Arrays for random selection
  const bomPartIds = ["WE0272", "FLNG_PRTC_2", "FG-40-1558_ REPAIR KIT SV-150"];
  const woProductCodes = ["_C-FBRCTN-N", "_C-VRM-IS-WLD-R", "_R-ACCU-BOTTL-R"];
  const operationSeqNos = [10, 20, 30, 40, 50];
  
  // Calculate dates
  const custOrderWantDateISO = formatDateISO(custOrderWantDate);
  // CUST_ORDER_LINE_WANT_DATE: future date lower than CUST_ORDER_WANT_DATE
  // It should be between today and CUST_ORDER_WANT_DATE
  const daysDiff = Math.floor((custOrderWantDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysBefore = daysDiff > 0 ? randomNumber(1, Math.min(daysDiff, 7)) : 1;
  const custOrderLineWantDate = addDays(custOrderWantDate, -daysBefore);
  const custOrderLineWantDateISO = formatDateISO(custOrderLineWantDate);
  // WO_RLS_DATE: future date (1-14 days from today)
  const woRlsDate = addDays(today, randomNumber(1, 14));
  const woRlsDateISO = formatDateISO(woRlsDate);
  // WO_WANT_DATE: future date (1-30 days from today)
  const woWantDate = addDays(today, randomNumber(1, 30));
  const woWantDateISO = formatDateISO(woWantDate);
  
  for (const entry of input.subIdEntries) {
    try {
      // Generate random values for this entry
      const bomPartId = randomFromArray(bomPartIds);
      const woProductCode = randomFromArray(woProductCodes);
      const bomOperationSeqNo = randomFromArray(operationSeqNos);
      
      // Generate random dates for other date fields
      const purcReqDate = addDays(today, randomNumber(0, 30));
      const purcReqWantDate = addDays(purcReqDate, randomNumber(1, 14));
      const purcOrderDate = addDays(today, randomNumber(0, 30));
      const poWantDate = addDays(purcOrderDate, randomNumber(1, 30));
      const poEtd = addDays(poWantDate, randomNumber(1, 14));
      const poEta = addDays(poEtd, randomNumber(1, 7));
      const grnDate = addDays(today, randomNumber(0, 60));
      const grnCreateDate = addDays(grnDate, randomNumber(0, 7));
      const invTransDate = addDays(today, randomNumber(0, 60));
      const invTransCreateDate = addDays(invTransDate, randomNumber(0, 7));
      
      await pb.collection(collections.erpConsolidateData).create({
        // Transaction info
        TXN_TYPE: "BOM",
        // Customer order info
        CUST_ORDER_ID: input.custOrderId,
        CUST_ORDER_LINE_NO: input.custOrderLineNo,
        CUST_ORDER_DATE: todayISO,
        CUST_ORDER_WANT_DATE: custOrderWantDateISO,
        CUST_ORDER_LINE_WANT_DATE: custOrderLineWantDateISO,
        CUST_ORDER_STATUS: "R",
        // Work order / BOM info
        BOM_WORKORDER_BASE_ID: input.workOrderNumber,
        BOM_WORKORDER_SUB_ID: String(entry.subId),
        BOM_WORKORDER_TYPE: "W",
        BOM_WORKORDER_LOT_ID: randomString(12),
        BOM_WORKORDER_SPLIT_ID: String(randomNumber(0, 9)),
        BOM_PART_ID: bomPartId,
        BOM_QTY: entry.quantity,
        BOM_OPERATION_SEQ_NO: bomOperationSeqNo,
        BOM_PIECE_NO: Number(entry.subId),
        // Work order assembly & status
        WO_ASSMB_PART_ID: randomString(10),
        WO_ASSMB_QTY: entry.quantity,
        WO_CREATE_DATE: todayISO,
        WO_RLS_DATE: woRlsDateISO,
        WO_WANT_DATE: woWantDateISO,
        WO_STATUS: "R",
        WO_PRODUCT_CODE: woProductCode,
        WO_ASW_STATUS: randomString(6),
        // Part info
        PART_IS_MANUFACTURE: randomFromArray(["Y", "N"]),
        PART_CATEGORY: "RM",
        // Purchase requisition (random values)
        PURC_REQ_ID: randomString(10),
        PURC_REQ_LINE_NO: randomNumber(1, 100),
        PURC_REQ_PART_ID: randomString(10),
        PURC_REQ_QTY: randomNumber(1, 1000),
        PURC_REQ_DATE: formatDateISO(purcReqDate),
        PURC_REQ_WANT_DATE: formatDateISO(purcReqWantDate),
        // Purchase order (random values)
        PURC_ORDER_ID: randomString(10),
        PO_LINE_NO: randomNumber(1, 100),
        PO_QTY: randomNumber(1, 1000),
        PURC_ORDER_DATE: formatDateISO(purcOrderDate),
        PURC_ORDER_STATUS: randomString(6),
        PO_WANT_DATE: formatDateISO(poWantDate),
        PO_ETD: formatDateISO(poEtd),
        PO_ETA: formatDateISO(poEta),
        // GRN (random values)
        GRN_ID: randomString(10),
        GRN_LINE_NO: randomNumber(1, 100),
        GRN_QTY: randomNumber(1, 1000),
        GRN_INSPECT_QTY: randomNumber(0, 1000),
        GRN_REJECTED_QTY: randomNumber(0, 100),
        GRN_DATE: formatDateISO(grnDate),
        GRN_CREATE_DATE: formatDateISO(grnCreateDate),
        // Inventory transaction (random values)
        INV_TRANS_ID: randomNumber(1000, 9999),
        INV_TRANS_PART_ID: randomString(10),
        INV_TRANS_TYPE: randomString(6),
        INV_TRANS_CLASS: randomString(6),
        INV_TRANS_QTY: randomNumber(1, 1000),
        INV_TRANS_DATE: formatDateISO(invTransDate),
        INV_TRANS_CREATE_DATE: formatDateISO(invTransCreateDate),
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

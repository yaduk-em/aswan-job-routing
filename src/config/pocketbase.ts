// ============================================================
// PocketBase Configuration
// Change these values to point to your PocketBase instance
// ============================================================

export type Instance = "DEV" | "UAT";

const INSTANCE_CONFIG: Record<Instance, { companyCode: string; plantCode: string; collectionPrefix: string }> = {
  DEV: {
    companyCode: "ASWANDUBAI",
    plantCode: "ASWNDUBAI",
    collectionPrefix: "ASWNDUBAI",
  },
  UAT: {
    companyCode: "ASWANUAT",
    plantCode: "ASWNUAT",
    collectionPrefix: "ASWNUAT",
  },
};

export function getCollections(instance: Instance) {
  const prefix = INSTANCE_CONFIG[instance].collectionPrefix;
  return {
    job: `${prefix}_Job`,
    jobProductReceipeRoutes: `${prefix}_jobProductReceipeRoutes`,
    receipeRouteMachines: `${prefix}_receipeRouteMachines`,
    machineMaster: `${prefix}_machineMaster`,
    erpConsolidateData: `${prefix}_erpConsolidateData`,
    jobDependencies: `${prefix}_jobDependencies`,
  };
}

export function getInstanceConfig(instance: Instance) {
  return INSTANCE_CONFIG[instance];
}

export const PB_CONFIG = {
  // PocketBase server URL
  url: "https://pb.dev.industryapps.net/ASWN",

  // Authentication credentials (admin or user)
  auth: {
    email: "abhi-s@industryapps.net",
    password: "Linux@1994",
  },

  // Default collections (DEV)
  collections: getCollections("DEV"),

  // Work order prefix
  workOrderPrefix: "IA-2026-",

  // Operations with their sequence numbers and mapped machine IDs
  operations: [
    { name: "MANUAL WORK - QC", sequence: "10", machineId: "MANUALWORK-QC" },
    { name: "FITTING AND ASSEMBLY - FLP", sequence: "20", machineId: "FIT-ASMBLY-FLP" },
    { name: "BLASTING BOOTH-01", sequence: "30", machineId: "BLAST-01" },
    { name: "AUTOTIG-02 FOR CLADDING - FRONIUS", sequence: "40", machineId: "AUTOTIG-01" },
    { name: "SUB CONTRACT", sequence: "50", machineId: "SUBCONTRACT" },
  ],
};

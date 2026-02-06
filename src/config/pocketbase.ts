// ============================================================
// PocketBase Configuration
// Change these values to point to your PocketBase instance
// ============================================================

export const PB_CONFIG = {
  // PocketBase server URL
  url: "https://pb.dev.industryapps.net/ASWN",

  // Authentication credentials (admin or user)
  auth: {
    email: "abhi-s@industryapps.net",
    password: "Linux@1994",
  },

  // Collection names - change these if your collections have different names
  collections: {
    job: "ASWNDUBAI_Job",
    jobProductReceipeRoutes: "ASWNDUBAI_jobProductReceipeRoutes",
    receipeRouteMachines: "ASWNDUBAI_receipeRouteMachines",
    machineMaster: "ASWNDUBAI_machineMaster",
  },

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

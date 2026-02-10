import { useState, useMemo } from "react";
import { PB_CONFIG } from "@/config/pocketbase";
import { createJobEntries } from "@/services/jobService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Package, Layers, Cog, CheckCircle2, AlertTriangle } from "lucide-react";

const JobRoutingForm = () => {
  const [workOrderSuffix, setWorkOrderSuffix] = useState("");
  const [numberOfSubIds, setNumberOfSubIds] = useState<number | "">("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [custOrderId, setCustOrderId] = useState("");
  const [custOrderLineNo, setCustOrderLineNo] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [result, setResult] = useState<{
    totalJobs: number;
    totalRoutes: number;
    totalMachines: number;
    totalConsolidateEntries: number;
    errors: string[];
  } | null>(null);

  const fullWorkOrderNumber = `${PB_CONFIG.workOrderPrefix}${workOrderSuffix}`;

  // Generate subId list: 1..N then 0 (main assembly)
  const subIdList = useMemo(() => {
    if (!numberOfSubIds || numberOfSubIds <= 0) return [];
    const ids: string[] = [];
    for (let i = 1; i <= numberOfSubIds; i++) {
      ids.push(String(i));
    }
    ids.push("0"); // Main assembly
    return ids;
  }, [numberOfSubIds]);

  // Validation helpers
  const workOrderError = !workOrderSuffix.trim() ? "Work order number is required" : "";
  const custOrderIdError = !custOrderId.trim() ? "Sales order ID is required" : "";
  const custOrderLineNoError =
    custOrderLineNo === "" || custOrderLineNo <= 0
      ? "Enter a valid line number (minimum 1)"
      : "";
  const subIdCountError =
    numberOfSubIds === "" || numberOfSubIds <= 0
      ? "Enter a valid number of sub IDs (minimum 1)"
      : "";
  const allQuantitiesValid = subIdList.length > 0 && subIdList.every((id) => quantities[id] && quantities[id] >= 1);
  const showError = (field: string) => submitAttempted || touched[field];

  const handleQuantityChange = (subId: string, value: string) => {
    const num = parseInt(value, 10);
    setTouched((prev) => ({ ...prev, [`qty-${subId}`]: true }));
    setQuantities((prev) => ({
      ...prev,
      [subId]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);

    // Mark all quantity fields as touched so errors show
    const allTouched: Record<string, boolean> = { workOrder: true, subIdCount: true, custOrderId: true, custOrderLineNo: true };
    subIdList.forEach((id) => { allTouched[`qty-${id}`] = true; });
    setTouched((prev) => ({ ...prev, ...allTouched }));

    if (workOrderError) {
      toast.error("Work order number is required");
      return;
    }

    if (subIdCountError) {
      toast.error("Please enter a valid number of sub IDs");
      return;
    }

    if (custOrderIdError) {
      toast.error("Sales order ID is required");
      return;
    }

    if (custOrderLineNoError) {
      toast.error("Please enter a valid line number");
      return;
    }

    if (!allQuantitiesValid) {
      toast.error("All sub ID quantities must be at least 1");
      return;
    }

    const subIdEntries = subIdList.map((subId) => ({
      subId,
      quantity: quantities[subId] || 0,
    }));

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await createJobEntries({
        workOrderNumber: fullWorkOrderNumber,
        subIdEntries,
        custOrderId,
        custOrderLineNo: Number(custOrderLineNo),
      });
      setResult(res);

      if (res.errors.length === 0) {
        toast.success(
          `Created ${res.totalConsolidateEntries} ERP entries, ${res.totalJobs} jobs, ${res.totalRoutes} routes, ${res.totalMachines} machines`
        );
      } else {
        toast.warning(`Completed with ${res.errors.length} warning(s)`);
      }
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalQuantity = subIdList.reduce(
    (sum, id) => sum + (quantities[id] || 0),
    0
  );
  const totalJobsPreview = totalQuantity;
  const totalRoutesPreview = totalQuantity * PB_CONFIG.operations.length;
  const totalMachinesPreview = totalRoutesPreview;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="w-full px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cog className="w-7 h-7" />
            <h1 className="text-xl font-bold tracking-tight">
              Aswan Job Routing
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 lg:px-10 py-6 space-y-5">
        {/* Work Order Input */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-accent" />
              Work Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="workOrder" className="text-sm font-semibold">
                Work Order Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-0">
                <span className="inline-flex items-center px-4 h-10 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm font-medium whitespace-nowrap">
                  {PB_CONFIG.workOrderPrefix}
                </span>
                <Input
                  id="workOrder"
                  value={workOrderSuffix}
                  onChange={(e) => setWorkOrderSuffix(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, workOrder: true }))}
                  placeholder="Enter work order number"
                  className={`rounded-l-none ${showError("workOrder") && workOrderError ? "border-destructive" : ""}`}
                  disabled={isSubmitting}
                  required
                />
              </div>
              {showError("workOrder") && workOrderError && (
                <p className="text-xs text-destructive">{workOrderError}</p>
              )}
              {workOrderSuffix && (
                <p className="text-xs text-muted-foreground">
                  Full: {fullWorkOrderNumber}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custOrderId" className="text-sm font-semibold">
                  Sales Order ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="custOrderId"
                  value={custOrderId}
                  onChange={(e) => setCustOrderId(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, custOrderId: true }))}
                  placeholder="Enter sales order ID"
                  className={showError("custOrderId") && custOrderIdError ? "border-destructive" : ""}
                  disabled={isSubmitting}
                  required
                />
                {showError("custOrderId") && custOrderIdError && (
                  <p className="text-xs text-destructive">{custOrderIdError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="custOrderLineNo" className="text-sm font-semibold">
                  Sales Order Line No <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="custOrderLineNo"
                  type="number"
                  min={1}
                  value={custOrderLineNo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustOrderLineNo(val === "" ? "" : parseInt(val, 10));
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, custOrderLineNo: true }))}
                  placeholder="Enter line number"
                  className={showError("custOrderLineNo") && custOrderLineNoError ? "border-destructive" : ""}
                  disabled={isSubmitting}
                  required
                />
                {showError("custOrderLineNo") && custOrderLineNoError && (
                  <p className="text-xs text-destructive">{custOrderLineNoError}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subIdCount" className="text-sm font-semibold">
                Number of Sub IDs <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subIdCount"
                type="number"
                min={1}
                value={numberOfSubIds}
                onChange={(e) => {
                  const val = e.target.value;
                  setNumberOfSubIds(val === "" ? "" : parseInt(val, 10));
                  setQuantities({});
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, subIdCount: true }))}
                placeholder="Enter number of sub IDs"
                className={`max-w-xs ${showError("subIdCount") && subIdCountError ? "border-destructive" : ""}`}
                disabled={isSubmitting}
                required
              />
              {showError("subIdCount") && subIdCountError && (
                <p className="text-xs text-destructive">{subIdCountError}</p>
              )}
              {numberOfSubIds !== "" && numberOfSubIds > 0 && (
                <p className="text-xs text-muted-foreground">
                  This will create Sub IDs 1–{numberOfSubIds} + Sub ID 0 (Main
                  Assembly) = {Number(numberOfSubIds) + 1} total
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SubId Quantities */}
        {subIdList.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="w-5 h-5 text-accent" />
                Sub ID Quantities <span className="text-destructive text-sm">*</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">All quantities are required and must be at least 1</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {subIdList.map((subId) => (
                  <div
                    key={subId}
                    className={`space-y-1.5 p-3 rounded-lg border ${
                      subId === "0"
                        ? "border-accent/40 bg-accent/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <Label
                      htmlFor={`qty-${subId}`}
                      className="text-xs font-semibold block"
                    >
                      {subId === "0" ? (
                        <span className="text-accent">
                          Sub ID 0{" "}
                          <span className="font-normal text-muted-foreground">
                            (Main)
                          </span>
                        </span>
                      ) : (
                        `Sub ID ${subId}`
                      )}
                    </Label>
                    <Input
                      id={`qty-${subId}`}
                      type="number"
                      min={1}
                      value={quantities[subId] ?? ""}
                      onChange={(e) =>
                        handleQuantityChange(subId, e.target.value)
                      }
                      onBlur={() => setTouched((prev) => ({ ...prev, [`qty-${subId}`]: true }))}
                      placeholder="Enter qty"
                      className={`h-9 text-center ${showError(`qty-${subId}`) && (!quantities[subId] || quantities[subId] <= 0) ? "border-destructive" : ""}`}
                      disabled={isSubmitting}
                      required
                    />
                    {showError(`qty-${subId}`) && (!quantities[subId] || quantities[subId] <= 0) && (
                      <p className="text-xs text-destructive">Required</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview & Submit */}
        {subIdList.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Records Preview</p>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{totalJobsPreview}</strong>{" "}
                      Jobs
                    </span>
                    <span>
                      <strong className="text-foreground">{totalRoutesPreview}</strong>{" "}
                      Routes
                    </span>
                    <span>
                      <strong className="text-foreground">
                        {totalMachinesPreview}
                      </strong>{" "}
                      Machines
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="font-semibold px-8"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Entries...
                    </>
                  ) : (
                    "Create Job Entries"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <Card
            className={
              result.errors.length > 0
                ? "border-warning/50"
                : "border-success/50"
            }
          >
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                {result.errors.length === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning" />
                )}
                <h3 className="font-semibold">
                  {result.errors.length === 0
                    ? "All entries created successfully!"
                    : "Completed with warnings"}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">
                    {result.totalJobs}
                  </p>
                  <p className="text-xs text-muted-foreground">Jobs Created</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">
                    {result.totalRoutes}
                  </p>
                  <p className="text-xs text-muted-foreground">Routes Created</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">
                    {result.totalMachines}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Machine Entries
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-warning">
                    Warnings ({result.errors.length}):
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <p
                        key={i}
                        className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded"
                      >
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Operations Reference */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Operations & Machine Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {PB_CONFIG.operations.map((op) => (
                <div
                  key={op.sequence}
                  className="flex items-center justify-between text-sm py-2 px-3 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">
                      {op.sequence}
                    </span>
                    <span className="font-medium">{op.name}</span>
                  </div>
                  <span className="text-xs industrial-badge">
                    {op.machineId}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default JobRoutingForm;

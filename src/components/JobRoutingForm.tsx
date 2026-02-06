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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    totalJobs: number;
    totalRoutes: number;
    totalMachines: number;
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

  const handleQuantityChange = (subId: string, value: string) => {
    const num = parseInt(value, 10);
    setQuantities((prev) => ({
      ...prev,
      [subId]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  const handleSubmit = async () => {
    if (!workOrderSuffix.trim()) {
      toast.error("Please enter the work order number");
      return;
    }
    if (!numberOfSubIds || numberOfSubIds <= 0) {
      toast.error("Please enter a valid number of sub IDs");
      return;
    }

    const subIdEntries = subIdList
      .map((subId) => ({
        subId,
        quantity: quantities[subId] || 0,
      }))
      .filter((e) => e.quantity > 0);

    if (subIdEntries.length === 0) {
      toast.error("Please enter at least one quantity");
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await createJobEntries({
        workOrderNumber: fullWorkOrderNumber,
        subIdEntries,
      });
      setResult(res);

      if (res.errors.length === 0) {
        toast.success(
          `Successfully created ${res.totalJobs} jobs, ${res.totalRoutes} routes, ${res.totalMachines} machine entries`
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
      <header className="industrial-header">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
              <Cog className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Aswan Job Routing
              </h1>
              <p className="text-sm opacity-70">Manufacturing Job Entry System</p>
            </div>
          </div>
          <div className="status-indicator text-primary-foreground">
            <span className="status-dot" />
            <span className="text-sm opacity-80">Connected</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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
                Work Order Number
              </Label>
              <div className="flex items-center gap-0">
                <span className="inline-flex items-center px-4 h-10 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground font-mono text-sm font-medium">
                  {PB_CONFIG.workOrderPrefix}
                </span>
                <Input
                  id="workOrder"
                  value={workOrderSuffix}
                  onChange={(e) => setWorkOrderSuffix(e.target.value)}
                  placeholder="123"
                  className="rounded-l-none font-mono"
                  disabled={isSubmitting}
                />
              </div>
              {workOrderSuffix && (
                <p className="text-xs text-muted-foreground font-mono">
                  Full: {fullWorkOrderNumber}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subIdCount" className="text-sm font-semibold">
                Number of Sub IDs
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
                placeholder="Enter number of sub IDs"
                className="max-w-xs"
                disabled={isSubmitting}
              />
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
                Sub ID Quantities
              </CardTitle>
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
                      min={0}
                      value={quantities[subId] ?? ""}
                      onChange={(e) =>
                        handleQuantityChange(subId, e.target.value)
                      }
                      placeholder="0"
                      className="h-9 font-mono text-center"
                      disabled={isSubmitting}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview & Submit */}
        {subIdList.length > 0 && totalQuantity > 0 && (
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
                  className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8"
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
                  <p className="text-2xl font-bold font-mono">
                    {result.totalJobs}
                  </p>
                  <p className="text-xs text-muted-foreground">Jobs Created</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold font-mono">
                    {result.totalRoutes}
                  </p>
                  <p className="text-xs text-muted-foreground">Routes Created</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold font-mono">
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
                    <span className="font-mono text-xs text-muted-foreground w-6">
                      {op.sequence}
                    </span>
                    <span className="font-medium">{op.name}</span>
                  </div>
                  <span className="font-mono text-xs industrial-badge">
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

import PocketBase from "pocketbase";
import { PB_CONFIG } from "@/config/pocketbase";

let pb: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (!pb) {
    pb = new PocketBase(PB_CONFIG.url);
  }
  return pb;
}

export async function authenticatePB(): Promise<PocketBase> {
  const client = getPocketBase();
  if (!client.authStore.isValid) {
    // Use legacy /api/admins/auth-with-password endpoint for older PocketBase versions
    const response = await fetch(`${PB_CONFIG.url}/api/admins/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: PB_CONFIG.auth.email,
        password: PB_CONFIG.auth.password,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Auth failed: ${err.message || response.statusText}`);
    }

    const data = await response.json();
    client.authStore.save(data.token, data.admin);
  }
  return client;
}

export function resetPBClient() {
  if (pb) {
    pb.authStore.clear();
  }
  pb = null;
}

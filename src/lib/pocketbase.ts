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
    await client.admins.authWithPassword(
      PB_CONFIG.auth.email,
      PB_CONFIG.auth.password
    );
  }
  return client;
}

export function resetPBClient() {
  if (pb) {
    pb.authStore.clear();
  }
  pb = null;
}

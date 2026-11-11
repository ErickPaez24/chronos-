import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID?.trim() || "ai-studio-70226889-530b-4929-a655-5b3dffe66368";

function loadCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) return cert(JSON.parse(json) as object);
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (path) return cert(JSON.parse(readFileSync(resolve(path), "utf8")) as object);
  return applicationDefault();
}

export function getAdminApp() {
  if (getApps().length) return getApps()[0]!;
  return initializeApp({
    credential: loadCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0801522147",
  });
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp(), DATABASE_ID);
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

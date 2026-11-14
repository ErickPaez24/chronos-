import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { PIN_INDEX_COLLECTION, pinHash } from "../shared/auth/pinIndex";

/** Devuelve el userId dueño del PIN, o null. */
export async function findUserIdByPin(pin: string): Promise<string | null> {
  const snap = await getDoc(doc(db, PIN_INDEX_COLLECTION, await pinHash(pin)));
  return snap.exists() ? (snap.data().userId as string) : null;
}

/** true si el PIN ya pertenece a otro empleado. */
export async function isPinTaken(pin: string, exceptUserId?: string): Promise<boolean> {
  const owner = await findUserIdByPin(pin);
  return owner !== null && owner !== exceptUserId;
}

/** Asigna el PIN al usuario y elimina los PINs anteriores de ese usuario. */
export async function setUserPin(userId: string, pin: string): Promise<void> {
  const hash = await pinHash(pin);
  const old = await getDocs(query(collection(db, PIN_INDEX_COLLECTION), where("userId", "==", userId)));
  await Promise.all(old.docs.filter((d) => d.id !== hash).map((d) => deleteDoc(d.ref)));
  await setDoc(doc(db, PIN_INDEX_COLLECTION, hash), { userId, updatedAt: serverTimestamp() });
}

/** Quita del índice los PINs del usuario (p. ej. si cambia a una contraseña que no es PIN). */
export async function clearUserPin(userId: string): Promise<void> {
  const old = await getDocs(query(collection(db, PIN_INDEX_COLLECTION), where("userId", "==", userId)));
  await Promise.all(old.docs.map((d) => deleteDoc(d.ref)));
}

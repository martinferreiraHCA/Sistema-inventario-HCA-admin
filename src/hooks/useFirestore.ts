import { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Product, StockMovement } from '../types';

export function useCollection<T extends { id: string }>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, collectionName));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as T[];
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error fetching ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [collectionName]);

  return { data, loading, error };
}

export async function addDocument(collectionName: string, data: DocumentData) {
  const colRef = collection(db, collectionName);
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
) {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDocument(collectionName: string, docId: string) {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
}

export interface StockMovementInput {
  productId: string;
  type: StockMovement['type'];
  quantity: number;
  reason: string;
  userId: string;
  userEmail: string;
}

/**
 * Registra un movimiento de stock y actualiza el producto en una sola
 * transaccion: el stock previo se lee dentro de la transaccion, por lo que
 * dos usuarios operando a la vez no pisan sus cambios ni dejan el historial
 * inconsistente con el stock real.
 */
export async function registerStockMovement(input: StockMovementInput): Promise<number> {
  return runTransaction(db, async (tx) => {
    const productRef = doc(db, 'products', input.productId);
    const snapshot = await tx.get(productRef);
    if (!snapshot.exists()) {
      throw new Error('El producto ya no existe');
    }
    const product = snapshot.data() as Product;
    const previousStock = product.stock ?? 0;

    let newStock = previousStock;
    if (input.type === 'in') newStock = previousStock + input.quantity;
    else if (input.type === 'out') newStock = Math.max(0, previousStock - input.quantity);
    else newStock = input.quantity;

    const now = new Date().toISOString();
    const movementRef = doc(collection(db, 'stockMovements'));
    tx.set(movementRef, {
      productId: input.productId,
      productName: product.name,
      sectorId: product.sectorId,
      type: input.type,
      quantity: input.quantity,
      previousStock,
      newStock,
      reason: input.reason,
      userId: input.userId,
      userEmail: input.userEmail,
      createdAt: now,
    });
    tx.update(productRef, {
      stock: newStock,
      lastModifiedBy: input.userEmail,
      lastModifiedAt: now,
      updatedAt: now,
    });

    return newStock;
  });
}

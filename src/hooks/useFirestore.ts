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
import type { Order, Product, StockMovement } from '../types';

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
    else if (input.type === 'out') {
      // Rechazar dentro de la transaccion: el chequeo del formulario usa el
      // stock cacheado y dos salidas concurrentes podrian dejar un historial
      // inconsistente (quantity != previousStock - newStock)
      if (input.quantity > previousStock) {
        throw new Error(`Stock insuficiente: quedan ${previousStock} ${product.unit || ''}`.trim());
      }
      newStock = previousStock - input.quantity;
    } else newStock = input.quantity;

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

export interface DeliveryResult {
  /** Productos del pedido que ya no existen (no se desconto stock) */
  missing: string[];
  /** Productos entregados con menos stock del pedido (se desconto lo disponible) */
  shorted: string[];
}

/**
 * Entrega un pedido en UNA sola transaccion: verifica que siga 'approved',
 * descuenta el stock de cada item registrando su movimiento y marca el pedido
 * como entregado. Un segundo intento (doble click, otro gestor, reintento tras
 * un corte) falla con un error claro en lugar de descontar stock dos veces.
 */
export async function deliverOrder(
  orderId: string,
  responseNotes: string,
  user: { uid: string; email: string }
): Promise<DeliveryResult> {
  return runTransaction(db, async (tx) => {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error('El pedido ya no existe');
    const order = orderSnap.data() as Order;
    if (order.status !== 'approved') {
      throw new Error(
        order.status === 'delivered'
          ? 'El pedido ya fue entregado'
          : 'El pedido ya no esta aprobado; revisa su estado actual'
      );
    }

    // En una transaccion todas las lecturas van antes de las escrituras
    const productSnaps = [];
    for (const item of order.items) {
      productSnaps.push({ item, snap: await tx.get(doc(db, 'products', item.productId)) });
    }

    const now = new Date().toISOString();
    const missing: string[] = [];
    const shorted: string[] = [];

    for (const { item, snap } of productSnaps) {
      if (!snap.exists()) {
        missing.push(item.productName);
        continue;
      }
      const product = snap.data() as Product;
      const previousStock = product.stock ?? 0;
      // Se entrega lo que hay: el movimiento registra lo realmente descontado
      const applied = Math.min(previousStock, item.quantity);
      if (applied < item.quantity) shorted.push(item.productName);
      if (applied > 0) {
        const movementRef = doc(collection(db, 'stockMovements'));
        tx.set(movementRef, {
          productId: item.productId,
          productName: product.name,
          sectorId: product.sectorId,
          type: 'out',
          quantity: applied,
          previousStock,
          newStock: previousStock - applied,
          reason:
            `Pedido entregado a ${order.sectorName} (${order.userName})` +
            (applied < item.quantity ? ` — pedido: ${item.quantity}, descontado: ${applied}` : ''),
          userId: user.uid,
          userEmail: user.email,
          createdAt: now,
        });
        tx.update(doc(db, 'products', item.productId), {
          stock: previousStock - applied,
          lastModifiedBy: user.email,
          lastModifiedAt: now,
          updatedAt: now,
        });
      }
    }

    tx.update(orderRef, { status: 'delivered', responseNotes, updatedAt: now });
    return { missing, shorted };
  });
}

import { db } from '@db';
import { products } from '@db/schema';
import type { CreateProductCommand } from './create-product.command';

export async function createProduct(input: CreateProductCommand) {
  const [row] = await db.insert(products).values(input).returning();
  return row!;
}

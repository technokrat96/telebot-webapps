import "server-only";
import { Prisma } from "@/generated/prisma/client";

/**
 * Type guard buat Prisma known-request error, pakai `instanceof` (bukan duck
 * typing manual) supaya `err` ter-narrow ke tipe yang benar.
 *
 * @param code opsional — kalau diisi, sekalian cek `err.code` cocok (mis. 'P2025').
 *
 * Contoh:
 *   if (isPrismaError(err, 'P2025')) return false; // record not found
 */
export function isPrismaError(
  err: unknown,
  code?: string,
): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (code === undefined || err.code === code)
  );
}

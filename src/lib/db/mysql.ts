import "server-only";

import mysql, {
  type Pool,
  type PoolConnection,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

let pool: Pool | null = null;

function getPoolConfig(): PoolOptions {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || "3306");
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "lf_home_decor";

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "+00:00",
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: false,
    connectTimeout: 10000,
  };
}

/**
 * Obtiene o inicializa el Connection Pool único de MySQL.
 */
export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(getPoolConfig());
  }
  return pool;
}

/**
 * Helper para consultas SELECT utilizando Prepared Statements.
 * Retorna un arreglo tipado con los resultados.
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    const [rows] = await getPool().execute<RowDataPacket[]>(
      sql,
      params as (string | number | boolean | null | Date)[]
    );
    return rows as unknown as T[];
  } catch (error) {
    console.error("MySQL query ERROR:", {
      message: error instanceof Error ? error.message : String(error),
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "lf_home_decor",
      user: process.env.DB_USER || "root",
      sql: sql.slice(0, 100),
    });
    throw error;
  }
}

/**
 * Helper para consultas SELECT que esperan un único registro.
 * Retorna el primer elemento o null si no hay coincidencias.
 */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Helper para operaciones INSERT, UPDATE, DELETE utilizando Prepared Statements.
 * Retorna el ResultSetHeader con insertId, affectedRows, etc.
 */
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<ResultSetHeader> {
  try {
    const [result] = await getPool().execute<ResultSetHeader>(
      sql,
      params as (string | number | boolean | null | Date)[]
    );
    return result;
  } catch (error) {
    console.error("MySQL execute ERROR:", {
      message: error instanceof Error ? error.message : String(error),
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "lf_home_decor",
      user: process.env.DB_USER || "root",
      sql: sql.slice(0, 100),
    });
    throw error;
  }
}

/**
 * Helper para ejecutar operaciones atómicas dentro de una Transacción MySQL.
 * Maneja automáticamente beginTransaction, commit, rollback y release de la conexión.
 */
export async function transaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Error durante rollback de transacción:", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

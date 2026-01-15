// src/jobs/queues.ts
import type Redis from "ioredis";
import { Queue } from "bullmq";
import { getBullRedis } from "../config/redis-bull";

/**
 * BullMQ can accept an ioredis instance. It will internally duplicate connections
 * where needed (e.g., blocking ops for workers).
 */
export function getBullConnection(): Redis {
  return getBullRedis();
}

export function createQueue<TData = any, TResult = any>(name: string) {
  return new Queue<TData, TResult>(name, {
    connection: getBullConnection()
  });
}

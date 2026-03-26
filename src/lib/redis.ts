import Redis from "ioredis";

const redisClient = new Redis(import.meta.env.REDIS_URL);

export default redisClient;

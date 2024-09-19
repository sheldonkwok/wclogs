import redis from "redis";

const redisUrl = import.meta.env.REDIS_URL;
const redisClient = redis.createClient({ url: redisUrl });
await redisClient.connect();

await redisClient.flushDb();

export default redisClient;

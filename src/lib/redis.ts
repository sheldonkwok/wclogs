import Redis from "ioredis";
import RedisMock from "ioredis-mock";

const redisClient = import.meta.env.DEV
  ? new RedisMock()
  : new Redis(import.meta.env.REDIS_URL);

export default redisClient;

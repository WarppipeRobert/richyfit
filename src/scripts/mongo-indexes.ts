import "dotenv/config";
import { connectMongo, disconnectMongo } from "../config/mongo";
import { ensureCheckinsIndexes } from "../config/mongoCheckins";

async function run() {
  await connectMongo();
  await ensureCheckinsIndexes();
  console.log("✅ checkins indexes ensured");
}

run()
  .then(async () => {
    await disconnectMongo();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await disconnectMongo();
    process.exit(1);
  });

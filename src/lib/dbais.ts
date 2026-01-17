import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI2) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI2"');
}

const uri = process.env.MONGODB_URI2;
const options = {};

let client2;
let clientPromise2: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise2?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise2) {
    client2 = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise2 = client2.connect();
  }
  clientPromise2 = globalWithMongo._mongoClientPromise2;
} else {
  client2 = new MongoClient(uri, options);
  clientPromise2 = client2.connect();
}

export default clientPromise2;
import {drizzle} from "drizzle-orm/node-postgres";
import {Pool} from "pg";
import {requests, requestsRelations, request_items, requestItemsRelations} from "./schema/indexSchema.js";
import { env } from "../env.js";

const createPool = ()=>{
    return new Pool({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
        max: 20,
        ssl: {
            rejectUnauthorized: false
        }
        //idleTimeoutMillis: 0,
        //keepAlive: true,
        //keepAliveInitialDelayMillis: 10000
    });
}

const schema = {requests, requestsRelations, request_items, requestItemsRelations}

export const db = drizzle(createPool(), {schema} );
export default db;
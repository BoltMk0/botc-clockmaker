import { createPool, createConnection, type RowDataPacket, type Pool } from 'mysql2/promise';
import { env } from '$env/dynamic/private';
import initScript from './db-init.sql?raw';

console.log("Database connection parameters:");
console.log(`Host: ${env.MYSQL_HOST ?? 'localhost'}`);
console.log(`Port: ${env.MYSQL_PORT ?? 3306}`);
console.log(`Database: ${env.MYSQL_DATABASE ?? 'botc'}`);
console.log(`User: ${env.MYSQL_USER ? '[REDACTED]' : 'Not Set'}`);
console.log(`Password: ${env.MYSQL_PASSWORD ? '[REDACTED]' : 'Not Set'}`);

const dbConfig = {
    host:     env.MYSQL_HOST     ?? 'localhost',
    port:     Number(env.MYSQL_PORT ?? 3306),
    database: env.MYSQL_DATABASE ?? 'botc-clocktower',
    user:     env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
};

async function initializeDatabase() {
    // Connect without selecting a database so we can check existence and create if needed
    const conn = await createConnection({ ...dbConfig, database: undefined, multipleStatements: true });
    try {
        const [rows] = await conn.query<RowDataPacket[]>(
            'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
            [dbConfig.database]
        );
        if (rows.length > 0) {
            console.log(`Database '${dbConfig.database}' already exists, skipping initialization.`);
            return;
        }
        await conn.query(
            `CREATE DATABASE \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await conn.query(`USE \`${dbConfig.database}\``);
        console.log('Initializing database...');
        await conn.query(initScript);
        console.log('Database initialized successfully.');
    } catch(error) {
        console.error('Error initializing database:', error);
        throw error;
    }
    finally {
        await conn.end();
    }
}

let pool: Pool | null = null;



// export default pool;

export default async function getPool(){
    if(!pool){
        await initializeDatabase();
        pool = createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit:    10,
            queueLimit:         0
        });
    }
    return pool;
}

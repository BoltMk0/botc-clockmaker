import { createPool, createConnection } from 'mysql2/promise';
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
    database: env.MYSQL_DATABASE ?? 'botc',
    user:     env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
};

async function initializeDatabase() {
    const conn = await createConnection({ ...dbConfig, multipleStatements: true });
    try {
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

initializeDatabase().catch((error) => console.error('Error initializing database:', error));

const pool = createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0
});

export default pool;

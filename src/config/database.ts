// TypeOrm Setup
import { DataSource } from "typeorm";
import dotenv from 'dotenv';
dotenv.config()

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || 'secureballot_user',
    password: process.env.DB_PASSWORD || 'secureballot_secure_pass',
    database: process.env.DB_NAME || 'secureballot_dev',
    synchronize: true,
    logging: true,
    entities: ['src/entities/*.ts'],
    migrations: ['src/migrations/*.ts'],
    subscribers: [],
});

export const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        console.log("Database connection established successfully.");
        return true
    } catch (error) {
        console.error("Error during database initialization:", error);
        throw error;
    }
};

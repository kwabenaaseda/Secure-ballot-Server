// TypeOrm Setup
import dotenv from "dotenv";
dotenv.config();

import { DataSource } from "typeorm";
import { ENV, VALIDATE_ENV } from "../workers/env_validator.ts";
VALIDATE_ENV();

export const AppDataSource = new DataSource({
    type: "postgres",
    host: ENV("DATABASE_HOST") || "127.0.0.1",
    port: parseInt(ENV("DATABASE_PORT") || "5432", 10),
    username: ENV("DATABASE_USERNAME") || 'secureballot_user',
    password: ENV("DATABASE_PASSWORD") || 'secureballot_secure_pass',
    database: ENV("DATABASE_NAME") || 'secureballot_dev',
    synchronize: false, // Set to false in production, true for development
    migrationsRun:false, // Set to true if you want migrations to run automatically on app start
    logging: false,
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
